/* eslint-disable @typescript-eslint/unbound-method */
import { ContentRiskCategory } from '../../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskCheckStatus } from '../../../../../../domain/content-risk-checks/enums/content-risk-check-status.enum';
import { ContentRiskLevel } from '../../../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { ContentRiskSourceType } from '../../../../../../domain/content-risk-checks/enums/content-risk-source-type.enum';
import { ContentRiskStepName } from '../../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { ContentRiskAnalysisResult } from '../../../../../../domain/content-risk-checks/types/content-risk-analysis-result.type';
import { ContentRiskCheck } from '../../../../../../domain/content-risk-checks/types/content-risk-check.type';
import { ContentRiskAnalysisResultsRepository } from '../../../../../../infrastructure/postgres/ports/content-risk-analysis-results.repository';
import { ContentRiskChecksRepository } from '../../../../../../infrastructure/postgres/ports/content-risk-checks.repository';
import { StepContext } from '../../contracts/step-context.type';
import { DetectDuplicateStep } from '../detect-duplicate.step';

const SELF_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ID = '00000000-0000-4000-8000-000000000002';
const PROMPT_ID = '00000000-0000-4000-8000-0000000000aa';

const ctx: StepContext = {
  checkId: SELF_ID,
  traceId: 'trace-1',
  promptVersionId: PROMPT_ID,
};

const input = { contentHash: 'hash-1', selfId: SELF_ID };

const buildCheck = (
  overrides: Partial<ContentRiskCheck> = {},
): ContentRiskCheck => ({
  id: OTHER_ID,
  requestId: 'req-1',
  traceId: 'trace-other',
  sourceType: ContentRiskSourceType.PLAIN_TEXT,
  status: ContentRiskCheckStatus.COMPLETED,
  currentStep: null,
  contentHash: 'hash-1',
  rawText: 'text',
  normalizedText: 'text',
  errorMessage: null,
  retryCount: 0,
  maxRetries: 3,
  replayOfCheckId: null,
  duplicateOfCheckId: null,
  promptVersionId: PROMPT_ID,
  startedAt: new Date('2024-01-01T00:00:00Z'),
  finishedAt: new Date('2024-01-01T00:00:01Z'),
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:01Z'),
  ...overrides,
});

const buildAnalysisResult = (
  overrides: Partial<ContentRiskAnalysisResult> = {},
): ContentRiskAnalysisResult => ({
  id: 'res-1',
  checkId: OTHER_ID,
  finalRiskLevel: ContentRiskLevel.MEDIUM,
  categories: [ContentRiskCategory.TOXICITY, ContentRiskCategory.HARASSMENT],
  matchedRulesCount: 2,
  totalRulesChecked: 9,
  flaggedFragments: [{ text: 'bad', reason: 'rude' }],
  matchedRules: [],
  summary: 'shared summary',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('DetectDuplicateStep', () => {
  let step: DetectDuplicateStep;
  let checksRepo: jest.Mocked<ContentRiskChecksRepository>;
  let analysisResultsRepo: jest.Mocked<ContentRiskAnalysisResultsRepository>;

  beforeEach(() => {
    checksRepo = {
      create: jest.fn(),
      getById: jest.fn(),
      getMany: jest.fn(),
      update: jest.fn(),
      findActiveByContentHash: jest.fn(),
    };
    analysisResultsRepo = {
      create: jest.fn(),
      getByCheckId: jest.fn(),
      delete: jest.fn(),
    };
    step = new DetectDuplicateStep(checksRepo, analysisResultsRepo);
  });

  it('returns null duplicateOfCheckId when no prior check exists', async () => {
    checksRepo.findActiveByContentHash.mockResolvedValue(null);

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.duplicateOfCheckId).toBeNull();
    expect(result.output.finalAnalysisResult).toBeNull();
    expect(analysisResultsRepo.create).not.toHaveBeenCalled();
  });

  it('treats a self-match as not a duplicate (excludes own id)', async () => {
    checksRepo.findActiveByContentHash.mockResolvedValue(
      buildCheck({ id: SELF_ID }),
    );

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.duplicateOfCheckId).toBeNull();
    expect(analysisResultsRepo.create).not.toHaveBeenCalled();
  });

  it('looks up only within same promptVersionId (cross-prompt isolation)', async () => {
    checksRepo.findActiveByContentHash.mockResolvedValue(null);

    await step.execute(input, ctx);

    expect(checksRepo.findActiveByContentHash).toHaveBeenCalledWith(
      'hash-1',
      PROMPT_ID,
    );
  });

  it('returns winner analysisResult when duplicate found, without writing to DB', async () => {
    checksRepo.findActiveByContentHash.mockResolvedValue(buildCheck());
    const sourceResult = buildAnalysisResult();
    analysisResultsRepo.getByCheckId.mockResolvedValue(sourceResult);

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.duplicateOfCheckId).toBe(OTHER_ID);
    expect(result.output.finalAnalysisResult).toBe(sourceResult);
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.DETECT_DUPLICATE,
      duplicateOfCheckId: OTHER_ID,
    });
    expect(analysisResultsRepo.create).not.toHaveBeenCalled();
  });

  it('returns DEDUP_LOOKUP_FAILED when checks repo throws', async () => {
    checksRepo.findActiveByContentHash.mockRejectedValue(new Error('db down'));

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DEDUP_LOOKUP_FAILED');
    expect(result.error.message).toBe('db down');
  });

  it('returns DEDUP_SOURCE_RESULT_MISSING when winner has no analysis result', async () => {
    checksRepo.findActiveByContentHash.mockResolvedValue(buildCheck());
    analysisResultsRepo.getByCheckId.mockResolvedValue(null);

    const result = await step.execute(input, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DEDUP_SOURCE_RESULT_MISSING');
  });
});
