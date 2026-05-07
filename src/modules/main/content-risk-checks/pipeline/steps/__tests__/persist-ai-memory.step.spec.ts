/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { ContentRiskCategory } from '../../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { ContentRiskStepName } from '../../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { AiAnalysisMemoryRepository } from '../../../../../../infrastructure/postgres/ports/ai-analysis-memory.repository';
import { StepContext } from '../../contracts/step-context.type';
import { PersistAiMemoryStep } from '../persist-ai-memory.step';

const CHECK_ID = '00000000-0000-4000-8000-000000000001';
const PROMPT_ID = '00000000-0000-4000-8000-0000000000aa';

const ctx: StepContext = {
  checkId: CHECK_ID,
  traceId: 'trace-1',
  promptVersionId: PROMPT_ID,
};

const buildInput = (
  overrides: Partial<{
    contentHash: string;
    normalizedText: string;
    embedding: number[];
    embeddingModel: string;
    finalRiskLevel: ContentRiskLevel;
    categories: ContentRiskCategory[];
    rationale: string;
  }> = {},
) => ({
  contentHash: 'hash-1',
  normalizedText: 'a perfectly fine sentence',
  embedding: [0.1, 0.2, 0.3],
  embeddingModel: 'openai/text-embedding-3-small',
  finalRiskLevel: ContentRiskLevel.LOW,
  categories: [ContentRiskCategory.SPAM],
  rationale: 'looks fine',
  ...overrides,
});

interface ConfigOverrides {
  AI_MEMORY_ENABLED?: boolean;
}

const buildConfig = (overrides: ConfigOverrides = {}): ConfigService => {
  const values: Record<string, unknown> = {
    AI_MEMORY_ENABLED: true,
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
};

const buildLogger = (): PinoLogger => {
  return {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as PinoLogger;
};

describe('PersistAiMemoryStep', () => {
  let memoryRepo: jest.Mocked<AiAnalysisMemoryRepository>;
  let logger: PinoLogger;

  beforeEach(() => {
    memoryRepo = {
      findSimilar: jest.fn(),
      create: jest.fn(),
    };
    logger = buildLogger();
  });

  it('skips with DISABLED when AI_MEMORY_ENABLED=false', async () => {
    const step = new PersistAiMemoryStep(
      memoryRepo,
      buildConfig({ AI_MEMORY_ENABLED: false }),
      logger,
    );

    const result = await step.execute(buildInput(), ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.persisted).toBe(false);
    expect(result.output.skipReason).toBe('DISABLED');
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.PERSIST_AI_MEMORY,
      persisted: false,
      skipReason: 'DISABLED',
    });
    expect(memoryRepo.create).not.toHaveBeenCalled();
  });

  it('skips with NO_EMBEDDING when embedding is empty', async () => {
    const step = new PersistAiMemoryStep(memoryRepo, buildConfig(), logger);

    const result = await step.execute(buildInput({ embedding: [] }), ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.persisted).toBe(false);
    expect(result.output.skipReason).toBe('NO_EMBEDDING');
    expect(memoryRepo.create).not.toHaveBeenCalled();
  });

  it('persists memory on happy path with sliced snippet and ctx-derived ids', async () => {
    const step = new PersistAiMemoryStep(memoryRepo, buildConfig(), logger);
    memoryRepo.create.mockResolvedValue({ id: 'mem-1' });

    const longText = 'x'.repeat(500);
    const input = buildInput({ normalizedText: longText });

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.persisted).toBe(true);
    expect(result.output.skipReason).toBeUndefined();
    expect(memoryRepo.create).toHaveBeenCalledTimes(1);
    expect(memoryRepo.create).toHaveBeenCalledWith({
      checkId: CHECK_ID,
      embedding: input.embedding,
      embeddingModel: input.embeddingModel,
      contentSnippet: longText.slice(0, 200),
      contentHash: input.contentHash,
      finalRiskLevel: input.finalRiskLevel,
      categories: input.categories,
      rationale: input.rationale,
      promptVersionId: PROMPT_ID,
    });
  });

  it('treats repo error as non-fatal, returns ok with REPO_ERROR and logs warn', async () => {
    const step = new PersistAiMemoryStep(memoryRepo, buildConfig(), logger);
    memoryRepo.create.mockResolvedValue(new Error('insert failed'));

    const result = await step.execute(buildInput(), ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.persisted).toBe(false);
    expect(result.output.skipReason).toBe('REPO_ERROR');
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.PERSIST_AI_MEMORY,
      persisted: false,
      skipReason: 'REPO_ERROR',
      errorMessage: 'insert failed',
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
