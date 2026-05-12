/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { ContentRiskCategory } from '../../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { ContentRiskStepName } from '../../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import {
  LLM_CLIENT,
  LlmClient,
  LlmCompletionOutput,
} from '../../../../../../infrastructure/llm/llm.types';
import {
  PROMPTS_REPOSITORY,
  PromptsRepository,
} from '../../../../../../infrastructure/postgres/ports/prompts.repository';
import { Prompt } from '../../../../../../domain/content-risk-checks/types/prompt.type';
import { StepContext } from '../../contracts/step-context.type';
import { AiAnalysisStep } from '../ai-analysis.step';

const PROMPT_ID = '00000000-0000-4000-8000-000000000001';
const CHECK_ID = '00000000-0000-4000-8000-000000000002';

const validAiOutput = {
  finalLevel: ContentRiskLevel.MEDIUM,
  categories: [ContentRiskCategory.TOXICITY],
  score: 0.6,
  rationale: 'Detected toxic language.',
  flaggedFragments: [{ text: 'bad', reason: 'rude' }],
};

const buildPrompt = (overrides: Partial<Prompt> = {}): Prompt => ({
  id: PROMPT_ID,
  name: 'risk-analysis',
  version: 3,
  template: JSON.stringify({
    system: 'you are a moderator',
    userTemplate: 'Text: {text}\nFlags: {rule_flags}',
  }),
  model: 'anthropic/claude-opus-4-5',
  isActive: true,
  createdAt: new Date(),
  ...overrides,
});

const buildLlmResponse = (
  content: string,
  tokensIn = 100,
  tokensOut = 50,
  finishReason: string | null = 'stop',
): LlmCompletionOutput => ({ content, tokensIn, tokensOut, finishReason });

const ctx: StepContext = {
  checkId: CHECK_ID,
  traceId: 'trace-1',
  promptVersionId: PROMPT_ID,
};

const input = {
  normalizedText: 'hello world',
  ruleFlags: [ContentRiskCategory.TOXICITY],
  examples: [],
};

describe('AiAnalysisStep', () => {
  let step: AiAnalysisStep;
  let llm: jest.Mocked<LlmClient>;
  let promptsRepo: jest.Mocked<PromptsRepository>;
  let configGet: jest.Mock;

  beforeEach(async () => {
    llm = { complete: jest.fn() };
    promptsRepo = {
      getActiveByName: jest.fn(),
      getById: jest.fn(),
      invalidateCache: jest.fn(),
    };
    configGet = jest.fn((key: string) => {
      if (key === 'LLM_VALIDATION_MAX_ATTEMPTS') return 2;
      if (key === 'LLM_MAX_TOKENS') return 2048;
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAnalysisStep,
        { provide: LLM_CLIENT, useValue: llm },
        { provide: PROMPTS_REPOSITORY, useValue: promptsRepo },
        { provide: ConfigService, useValue: { get: configGet } },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    step = module.get(AiAnalysisStep);
  });

  it('happy path: returns ok with attempts=1 on first-shot success', async () => {
    promptsRepo.getById.mockResolvedValue(buildPrompt());
    llm.complete.mockResolvedValueOnce(
      buildLlmResponse(JSON.stringify(validAiOutput), 12, 7),
    );

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.finalLevel).toBe(ContentRiskLevel.MEDIUM);
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.RUN_AI_ANALYSIS,
      attempts: 1,
      tokensIn: 12,
      tokensOut: 7,
    });
    expect(llm.complete).toHaveBeenCalledTimes(1);
  });

  it('succeeds on the second attempt when first response is invalid (details.attempts === 2)', async () => {
    promptsRepo.getById.mockResolvedValue(buildPrompt());
    llm.complete
      .mockResolvedValueOnce(buildLlmResponse('garbage', 10, 5))
      .mockResolvedValueOnce(
        buildLlmResponse(JSON.stringify(validAiOutput), 30, 15),
      );

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.RUN_AI_ANALYSIS,
      promptVersion: 3,
      tokensIn: 40,
      tokensOut: 20,
      attempts: 2,
    });

    const secondCallUserMsg = llm.complete.mock.calls[1][0].user;
    expect(secondCallUserMsg).toContain(
      'Your previous response failed validation',
    );
    expect(secondCallUserMsg).toContain('JSON.parse failed');
  });

  it('returns AI_VALIDATION_FAILED after two invalid JSON responses', async () => {
    promptsRepo.getById.mockResolvedValue(buildPrompt());
    llm.complete
      .mockResolvedValueOnce(buildLlmResponse('not json', 10, 5))
      .mockResolvedValueOnce(buildLlmResponse('still not json', 20, 10));

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AI_VALIDATION_FAILED');
    expect(result.error.message).toContain('Failed schema validation');
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.RUN_AI_ANALYSIS,
      promptVersion: 3,
      tokensIn: 30,
      tokensOut: 15,
    });
    expect(llm.complete).toHaveBeenCalledTimes(2);
  });

  it('returns PROMPT_NOT_FOUND when prompt repo returns null', async () => {
    promptsRepo.getById.mockResolvedValue(null);

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PROMPT_NOT_FOUND');
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('returns PROMPT_LOOKUP_FAILED when prompt repo throws', async () => {
    promptsRepo.getById.mockRejectedValue(new Error('db down'));

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PROMPT_LOOKUP_FAILED');
    expect(result.error.message).toBe('db down');
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('returns LLM_CALL_FAILED with NO retry when llm.complete throws', async () => {
    promptsRepo.getById.mockResolvedValue(buildPrompt());
    llm.complete.mockRejectedValueOnce(
      new Error('OpenRouter: timeout after 15000ms'),
    );

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('LLM_CALL_FAILED');
    expect(result.error.message).toContain('timeout');
    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.RUN_AI_ANALYSIS,
      promptVersion: 3,
      tokensIn: 0,
      tokensOut: 0,
    });
  });

  it('returns PROMPT_TEMPLATE_INVALID when template is not valid JSON', async () => {
    promptsRepo.getById.mockResolvedValue(
      buildPrompt({ template: 'not-json' }),
    );

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PROMPT_TEMPLATE_INVALID');
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('renders {text} and {rule_flags} into user message; uses "none" when no flags', async () => {
    promptsRepo.getById.mockResolvedValue(buildPrompt());
    llm.complete.mockResolvedValueOnce(
      buildLlmResponse(JSON.stringify(validAiOutput)),
    );

    await step.execute(
      { normalizedText: 'sample text', ruleFlags: [], examples: [] },
      ctx,
    );

    const callArgs = llm.complete.mock.calls[0][0];
    expect(callArgs.user).toContain('Text: sample text');
    expect(callArgs.user).toContain('Flags: none');
    expect(callArgs.system).toBe('you are a moderator');
    expect(callArgs.model).toBe('anthropic/claude-opus-4-5');
    expect(callArgs.temperature).toBe(0);
  });

  it('joins rule flags with comma in user message', async () => {
    promptsRepo.getById.mockResolvedValue(buildPrompt());
    llm.complete.mockResolvedValueOnce(
      buildLlmResponse(JSON.stringify(validAiOutput)),
    );

    await step.execute(
      {
        normalizedText: 'x',
        ruleFlags: [ContentRiskCategory.HATE, ContentRiskCategory.THREAT],
        examples: [],
      },
      ctx,
    );

    expect(llm.complete.mock.calls[0][0].user).toContain('Flags: HATE, THREAT');
  });

  it('passes LLM_MAX_TOKENS as maxTokens on first attempt', async () => {
    promptsRepo.getById.mockResolvedValue(buildPrompt());
    llm.complete.mockResolvedValueOnce(
      buildLlmResponse(JSON.stringify(validAiOutput)),
    );

    await step.execute(input, ctx);

    expect(llm.complete.mock.calls[0][0].maxTokens).toBe(2048);
  });

  it('doubles maxTokens and uses truncation-specific prompt on retry when finish_reason=length', async () => {
    promptsRepo.getById.mockResolvedValue(buildPrompt());
    llm.complete
      .mockResolvedValueOnce(
        buildLlmResponse('{"finalLevel":"MED', 50, 2048, 'length'),
      )
      .mockResolvedValueOnce(
        buildLlmResponse(JSON.stringify(validAiOutput), 60, 80),
      );

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(llm.complete).toHaveBeenCalledTimes(2);
    expect(llm.complete.mock.calls[0][0].maxTokens).toBe(2048);
    expect(llm.complete.mock.calls[1][0].maxTokens).toBe(4096);
    const secondMsg = llm.complete.mock.calls[1][0].user;
    expect(secondMsg).toContain('cut off at the token limit');
    expect(secondMsg).not.toContain('failed validation');
    expect(result.details).toMatchObject({ attempts: 2 });
  });

  it('returns AI_RESPONSE_TRUNCATED when truncation persists across attempts', async () => {
    promptsRepo.getById.mockResolvedValue(buildPrompt());
    llm.complete
      .mockResolvedValueOnce(buildLlmResponse('{"final', 50, 2048, 'length'))
      .mockResolvedValueOnce(buildLlmResponse('{"final', 50, 4096, 'length'));

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AI_RESPONSE_TRUNCATED');
    expect(llm.complete).toHaveBeenCalledTimes(2);
    expect(llm.complete.mock.calls[1][0].maxTokens).toBe(4096);
  });

  it('reports schema-violation messages from zod on second attempt prompt', async () => {
    promptsRepo.getById.mockResolvedValue(buildPrompt());
    const wrongShape = { finalLevel: 'NOPE' };
    llm.complete
      .mockResolvedValueOnce(buildLlmResponse(JSON.stringify(wrongShape)))
      .mockResolvedValueOnce(buildLlmResponse(JSON.stringify(validAiOutput)));

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    const secondMsg = llm.complete.mock.calls[1][0].user;
    expect(secondMsg).toContain('Your previous response failed validation');
    expect(secondMsg).toContain('finalLevel');
  });
});
