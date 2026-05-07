/* eslint-disable @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ContentRiskCategory } from '../../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { ContentRiskStepName } from '../../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { AiFewShotExample } from '../../../../../../domain/content-risk-checks/types/ai-few-shot-example.type';
import {
  EMBEDDING_CLIENT,
  EmbeddingClient,
  EmbeddingError,
} from '../../../../../../infrastructure/embedding/embedding-client.port';
import {
  AI_ANALYSIS_MEMORY_REPOSITORY,
  AiAnalysisMemoryRepository,
} from '../../../../../../infrastructure/postgres/ports/ai-analysis-memory.repository';
import { StepContext } from '../../contracts/step-context.type';
import { RetrieveAiContextStep } from '../retrieve-ai-context.step';

const PROMPT_ID = '00000000-0000-4000-8000-000000000001';
const CHECK_ID = '00000000-0000-4000-8000-000000000002';
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';

const ctx: StepContext = {
  checkId: CHECK_ID,
  traceId: 'trace-1',
  promptVersionId: PROMPT_ID,
};

const input = {
  normalizedText: 'hello world',
  selfId: CHECK_ID,
};

const buildExample = (similarity: number): AiFewShotExample => ({
  contentSnippet: 'similar text',
  finalRiskLevel: ContentRiskLevel.LOW,
  categories: [ContentRiskCategory.SPAM],
  rationale: 'looks fine',
  similarity,
});

interface ConfigOverrides {
  AI_MEMORY_ENABLED?: boolean;
  AI_MEMORY_TOP_N?: number;
  AI_MEMORY_MIN_SIMILARITY?: number;
  AI_EMBEDDING_MODEL?: string;
}

const buildConfig = (overrides: ConfigOverrides = {}): ConfigService => {
  const values: Record<string, unknown> = {
    AI_MEMORY_ENABLED: true,
    AI_MEMORY_TOP_N: 3,
    AI_MEMORY_MIN_SIMILARITY: 0.85,
    AI_EMBEDDING_MODEL: EMBEDDING_MODEL,
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
};

describe('RetrieveAiContextStep', () => {
  let step: RetrieveAiContextStep;
  let embeddingClient: jest.Mocked<EmbeddingClient>;
  let memoryRepo: jest.Mocked<AiAnalysisMemoryRepository>;

  const buildModule = async (config: ConfigService): Promise<TestingModule> =>
    Test.createTestingModule({
      providers: [
        RetrieveAiContextStep,
        { provide: EMBEDDING_CLIENT, useValue: embeddingClient },
        { provide: AI_ANALYSIS_MEMORY_REPOSITORY, useValue: memoryRepo },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

  beforeEach(() => {
    embeddingClient = { embed: jest.fn() };
    memoryRepo = {
      findSimilar: jest.fn(),
      create: jest.fn(),
    };
  });

  it('returns empty examples and skips embedding when AI_MEMORY_ENABLED=false', async () => {
    const module = await buildModule(buildConfig({ AI_MEMORY_ENABLED: false }));
    step = module.get(RetrieveAiContextStep);

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.examples).toEqual([]);
    expect(result.output.embedding).toEqual([]);
    expect(result.output.embeddingModel).toBe(EMBEDDING_MODEL);
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.RETRIEVE_AI_CONTEXT,
      enabled: false,
      examplesFound: 0,
    });
    expect(embeddingClient.embed).not.toHaveBeenCalled();
    expect(memoryRepo.findSimilar).not.toHaveBeenCalled();
  });

  it('degrades gracefully when embedding client returns EmbeddingError', async () => {
    const module = await buildModule(buildConfig());
    step = module.get(RetrieveAiContextStep);

    embeddingClient.embed.mockResolvedValue(
      new EmbeddingError('TIMEOUT', 'embedding timeout'),
    );

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.examples).toEqual([]);
    expect(result.output.embedding).toEqual([]);
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.RETRIEVE_AI_CONTEXT,
      enabled: true,
      examplesFound: 0,
      embeddingErrorCode: 'TIMEOUT',
      embeddingErrorMessage: 'embedding timeout',
    });
    expect(memoryRepo.findSimilar).not.toHaveBeenCalled();
  });

  it('degrades gracefully when memory repo throws', async () => {
    const module = await buildModule(buildConfig());
    step = module.get(RetrieveAiContextStep);

    const embedding = [0.1, 0.2, 0.3];
    embeddingClient.embed.mockResolvedValue(embedding);
    memoryRepo.findSimilar.mockRejectedValue(new Error('db down'));

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.examples).toEqual([]);
    expect(result.output.embedding).toEqual(embedding);
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.RETRIEVE_AI_CONTEXT,
      enabled: true,
      examplesFound: 0,
      repoErrorMessage: 'db down',
    });
  });

  it('cold start: returns empty examples with examplesFound=0 and avg/top similarity 0', async () => {
    const module = await buildModule(buildConfig());
    step = module.get(RetrieveAiContextStep);

    embeddingClient.embed.mockResolvedValue([0.1, 0.2]);
    memoryRepo.findSimilar.mockResolvedValue([]);

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.examples).toEqual([]);
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.RETRIEVE_AI_CONTEXT,
      enabled: true,
      examplesFound: 0,
      avgSimilarity: 0,
      topSimilarity: 0,
    });
  });

  it('returns 2 examples with correct avgSimilarity and topSimilarity', async () => {
    const module = await buildModule(buildConfig());
    step = module.get(RetrieveAiContextStep);

    const embedding = [0.5, 0.5];
    const examples = [buildExample(0.95), buildExample(0.85)];

    embeddingClient.embed.mockResolvedValue(embedding);
    memoryRepo.findSimilar.mockResolvedValue(examples);

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.examples).toHaveLength(2);
    expect(result.output.embedding).toEqual(embedding);
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.RETRIEVE_AI_CONTEXT,
      enabled: true,
      examplesFound: 2,
      topSimilarity: 0.95,
    });
    if (result.details.stepName !== ContentRiskStepName.RETRIEVE_AI_CONTEXT) {
      throw new Error('unreachable');
    }
    expect(result.details.avgSimilarity).toBeCloseTo(0.9, 10);

    expect(memoryRepo.findSimilar).toHaveBeenCalledWith(embedding, PROMPT_ID, {
      topN: 3,
      minSimilarity: 0.85,
      excludeCheckId: CHECK_ID,
    });
  });
});
