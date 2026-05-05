import { ContentRiskCategory } from '../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import type { PrismaService } from '../../prisma/prisma.service';
import { PrismaAiAnalysisMemoryRepository } from '../prisma-ai-analysis-memory.repository';
import {
  AI_MEMORY_DUPLICATE_CHECK_ID,
  FAILED_TO_CREATE_AI_MEMORY,
  FAILED_TO_FIND_SIMILAR_AI_MEMORIES,
} from '../repository-error-messages';

const PROMPT_VERSION_ID = '00000000-0000-4000-8000-000000000001';
const CHECK_ID = '00000000-0000-4000-8000-000000000002';
const buildEmbedding = () => Array.from({ length: 1536 }, (_, i) => i / 1536);

describe('PrismaAiAnalysisMemoryRepository', () => {
  let queryRaw: jest.Mock;
  let repo: PrismaAiAnalysisMemoryRepository;

  beforeEach(() => {
    queryRaw = jest.fn();
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    repo = new PrismaAiAnalysisMemoryRepository(prisma);
  });

  describe('findSimilar', () => {
    it('returns [] on empty DB', async () => {
      queryRaw.mockResolvedValueOnce([]);

      const result = await repo.findSimilar(
        buildEmbedding(),
        PROMPT_VERSION_ID,
        {
          topN: 3,
          minSimilarity: 0.85,
          excludeCheckId: CHECK_ID,
        },
      );

      expect(result).toEqual([]);
    });

    it('filters out rows below minSimilarity', async () => {
      queryRaw.mockResolvedValueOnce([
        {
          contentSnippet: 'a',
          finalRiskLevel: ContentRiskLevel.HIGH,
          categories: [ContentRiskCategory.HATE],
          rationale: 'r1',
          similarity: 0.9,
        },
        {
          contentSnippet: 'b',
          finalRiskLevel: ContentRiskLevel.LOW,
          categories: [],
          rationale: 'r2',
          similarity: 0.5,
        },
      ]);

      const result = await repo.findSimilar(
        buildEmbedding(),
        PROMPT_VERSION_ID,
        {
          topN: 3,
          minSimilarity: 0.85,
          excludeCheckId: CHECK_ID,
        },
      );

      expect(Array.isArray(result)).toBe(true);
      if (result instanceof Error) return;
      expect(result).toHaveLength(1);
      expect(result[0].contentSnippet).toBe('a');
      expect(result[0].similarity).toBe(0.9);
    });

    it('returns Error when prisma throws', async () => {
      queryRaw.mockRejectedValueOnce(new Error('db down'));

      const result = await repo.findSimilar(
        buildEmbedding(),
        PROMPT_VERSION_ID,
        {
          topN: 3,
          minSimilarity: 0.85,
          excludeCheckId: CHECK_ID,
        },
      );

      expect(result).toBeInstanceOf(Error);
      if (!(result instanceof Error)) return;
      expect(result.message).toBe(FAILED_TO_FIND_SIMILAR_AI_MEMORIES);
    });
  });

  describe('create', () => {
    const buildInput = () => ({
      checkId: CHECK_ID,
      embedding: buildEmbedding(),
      embeddingModel: 'openai/text-embedding-3-small',
      contentSnippet: 'snippet',
      contentHash: 'hash',
      finalRiskLevel: ContentRiskLevel.MEDIUM,
      categories: [ContentRiskCategory.TOXICITY],
      rationale: 'rationale',
      promptVersionId: PROMPT_VERSION_ID,
    });

    it('returns inserted id on success', async () => {
      queryRaw.mockResolvedValueOnce([{ id: 'memory-id-1' }]);

      const result = await repo.create(buildInput());

      expect(result).toEqual({ id: 'memory-id-1' });
    });

    it('returns duplicate-checkId error when ON CONFLICT skips insert', async () => {
      queryRaw.mockResolvedValueOnce([]);

      const result = await repo.create(buildInput());

      expect(result).toBeInstanceOf(Error);
      if (!(result instanceof Error)) return;
      expect(result.message).toBe(AI_MEMORY_DUPLICATE_CHECK_ID);
    });

    it('returns Error when prisma throws', async () => {
      queryRaw.mockRejectedValueOnce(new Error('db down'));

      const result = await repo.create(buildInput());

      expect(result).toBeInstanceOf(Error);
      if (!(result instanceof Error)) return;
      expect(result.message).toBe(FAILED_TO_CREATE_AI_MEMORY);
    });
  });
});
