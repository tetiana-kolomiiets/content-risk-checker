/* eslint-disable @typescript-eslint/unbound-method */
import { PinoLogger } from 'nestjs-pino';
import { ContentRiskCategory } from '../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskCheckStatus } from '../../../../../domain/content-risk-checks/enums/content-risk-check-status.enum';
import { ContentRiskLevel } from '../../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { ContentRiskSourceType } from '../../../../../domain/content-risk-checks/enums/content-risk-source-type.enum';
import { ContentRiskStepName } from '../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { StepExecutionStatus } from '../../../../../domain/content-risk-checks/enums/step-execution-status.enum';
import { ContentRiskAnalysisResult } from '../../../../../domain/content-risk-checks/types/content-risk-analysis-result.type';
import { ContentRiskCheck } from '../../../../../domain/content-risk-checks/types/content-risk-check.type';
import { ContentRiskStepLog } from '../../../../../domain/content-risk-checks/types/content-risk-step-log.type';
import { ContentRiskAnalysisResultsRepository } from '../../../../../infrastructure/postgres/ports/content-risk-analysis-results.repository';
import { ContentRiskChecksRepository } from '../../../../../infrastructure/postgres/ports/content-risk-checks.repository';
import { ContentRiskStepLogsRepository } from '../../../../../infrastructure/postgres/ports/content-risk-step-logs.repository';
import { ContentRiskChecksPipelineService } from '../../content-risk-checks-pipeline.service';
import { PipelineFailedError } from '../contracts/pipeline-error';
import { PipelineStep } from '../contracts/pipeline-step.interface';
import { StepResult } from '../contracts/step-result.type';
import { AggregateResultStep } from '../steps/aggregate-result.step';
import { AiAnalysisStep } from '../steps/ai-analysis.step';
import { DetectDuplicateStep } from '../steps/detect-duplicate.step';
import { NormalizeTextStep } from '../steps/normalize-text.step';
import { PersistAiMemoryStep } from '../steps/persist-ai-memory.step';
import { RetrieveAiContextStep } from '../steps/retrieve-ai-context.step';
import { RuleBasedScanStep } from '../steps/rule-based-scan.step';

const CHECK_ID = '00000000-0000-4000-8000-000000000010';
const PROMPT_ID = '00000000-0000-4000-8000-0000000000aa';
const TRACE_ID = 'trace-runner-1';
const WINNER_ID = '00000000-0000-4000-8000-000000000099';

const buildCheck = (
  overrides: Partial<ContentRiskCheck> = {},
): ContentRiskCheck => ({
  id: CHECK_ID,
  requestId: 'req-1',
  traceId: TRACE_ID,
  sourceType: ContentRiskSourceType.PLAIN_TEXT,
  status: ContentRiskCheckStatus.PENDING,
  currentStep: null,
  contentHash: 'hash-1',
  rawText: 'hello world',
  normalizedText: null,
  errorMessage: null,
  retryCount: 0,
  maxRetries: 3,
  replayOfCheckId: null,
  duplicateOfCheckId: null,
  promptVersionId: PROMPT_ID,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildAnalysisResult = (
  overrides: Partial<ContentRiskAnalysisResult> = {},
): ContentRiskAnalysisResult => ({
  id: 'res-winner',
  checkId: WINNER_ID,
  finalRiskLevel: ContentRiskLevel.HIGH,
  categories: [ContentRiskCategory.HATE],
  matchedRulesCount: 2,
  totalRulesChecked: 9,
  flaggedFragments: [{ text: 'foo', reason: 'bar' }],
  matchedRules: [],
  summary: 'winner summary',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const buildStepLog = (
  id: string,
  status: StepExecutionStatus = StepExecutionStatus.STARTED,
): ContentRiskStepLog => ({
  id,
  checkId: CHECK_ID,
  traceId: TRACE_ID,
  stepName: ContentRiskStepName.NORMALIZE_TEXT,
  status,
  attempt: 1,
  message: null,
  errorMessage: null,
  details: null,
  startedAt: new Date(),
  finishedAt: null,
  durationMs: null,
  createdAt: new Date(),
});

interface StubStep<I, O> extends PipelineStep<I, O> {
  execute: jest.Mock<Promise<StepResult<O>>, [I, unknown]>;
}

const makeStep = <I, O>(name: ContentRiskStepName): StubStep<I, O> => ({
  name,
  execute: jest.fn() as StubStep<I, O>['execute'],
});

const ok = <O>(output: O, details: unknown): StepResult<O> => ({
  ok: true,
  output,
  details: details as never,
});

const fail = <O>(
  code: string,
  message: string,
  details: unknown,
): StepResult<O> => ({
  ok: false,
  error: { code, message },
  details: details as never,
});

const normalizeDetails = {
  stepName: ContentRiskStepName.NORMALIZE_TEXT,
  charsRemoved: 0,
  lowercased: true,
};
const dedupeDetails = (winnerId: string | null) => ({
  stepName: ContentRiskStepName.DETECT_DUPLICATE,
  duplicateOfCheckId: winnerId,
});
const ruleDetails = {
  stepName: ContentRiskStepName.RUN_RULE_BASED_CHECKS,
  matchedRulesCount: 0,
  totalRulesChecked: 9,
  flags: [],
  score: 0,
};
const retrieveDetails = {
  stepName: ContentRiskStepName.RETRIEVE_AI_CONTEXT,
  enabled: true,
  examplesFound: 0,
};
const aiDetails = {
  stepName: ContentRiskStepName.RUN_AI_ANALYSIS,
  promptVersion: 1,
  tokensIn: 10,
  tokensOut: 5,
  attempts: 1,
};
const aggDetails = {
  stepName: ContentRiskStepName.AGGREGATE_RESULT,
  ruleScore: 0,
  aiScore: 0,
  finalScore: 0,
  finalLevel: ContentRiskLevel.LOW,
};
const persistMemoryDetails = {
  stepName: ContentRiskStepName.PERSIST_AI_MEMORY,
  persisted: true,
};

describe('ContentRiskChecksPipelineService (PipelineRunner)', () => {
  let runner: ContentRiskChecksPipelineService;
  let checksRepo: jest.Mocked<ContentRiskChecksRepository>;
  let analysisResultsRepo: jest.Mocked<ContentRiskAnalysisResultsRepository>;
  let stepLogsRepo: jest.Mocked<ContentRiskStepLogsRepository>;
  let normalize: StubStep<unknown, { normalizedText: string }>;
  let detectDuplicate: StubStep<
    unknown,
    {
      duplicateOfCheckId: string | null;
      finalAnalysisResult: ContentRiskAnalysisResult | null;
    }
  >;
  let ruleBasedScan: StubStep<
    unknown,
    {
      score: number;
      flags: ContentRiskCategory[];
      matchedRules: unknown[];
      matchedRulesCount: number;
      totalRulesChecked: number;
      flaggedFragments: Array<{ text: string; reason: string }>;
    }
  >;
  let retrieveAiContext: StubStep<
    unknown,
    { examples: never[]; embedding: number[]; embeddingModel: string }
  >;
  let aiAnalysis: StubStep<
    unknown,
    {
      finalLevel: ContentRiskLevel;
      categories: ContentRiskCategory[];
      score: number;
      rationale: string;
      flaggedFragments: Array<{ text: string; reason: string }>;
    }
  >;
  let aggregate: StubStep<
    unknown,
    {
      finalRiskLevel: ContentRiskLevel;
      categories: ContentRiskCategory[];
      matchedRulesCount: number;
      totalRulesChecked: number;
      flaggedFragments: unknown;
      matchedRules: unknown;
      summary: string;
    }
  >;
  let persistAiMemory: StubStep<
    unknown,
    { persisted: boolean; skipReason?: string }
  >;

  beforeEach(() => {
    checksRepo = {
      create: jest.fn(),
      getById: jest.fn(),
      getMany: jest.fn(),
      update: jest.fn(),
      findByContentHash: jest.fn(),
      findActiveByContentHash: jest.fn(),
    };
    analysisResultsRepo = {
      create: jest.fn(),
      getByCheckId: jest.fn(),
      delete: jest.fn(),
    };
    stepLogsRepo = {
      create: jest.fn(),
      update: jest.fn(),
      getByCheckId: jest.fn(),
    };
    normalize = makeStep(ContentRiskStepName.NORMALIZE_TEXT);
    detectDuplicate = makeStep(ContentRiskStepName.DETECT_DUPLICATE);
    ruleBasedScan = makeStep(ContentRiskStepName.RUN_RULE_BASED_CHECKS);
    retrieveAiContext = makeStep(ContentRiskStepName.RETRIEVE_AI_CONTEXT);
    aiAnalysis = makeStep(ContentRiskStepName.RUN_AI_ANALYSIS);
    aggregate = makeStep(ContentRiskStepName.AGGREGATE_RESULT);
    persistAiMemory = makeStep(ContentRiskStepName.PERSIST_AI_MEMORY);

    const logger: Partial<PinoLogger> = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    let logIdCounter = 0;
    stepLogsRepo.create.mockImplementation(() => {
      logIdCounter += 1;
      return Promise.resolve(buildStepLog(`log-${logIdCounter}`));
    });
    stepLogsRepo.update.mockImplementation((id: string) =>
      Promise.resolve(buildStepLog(id)),
    );

    runner = new ContentRiskChecksPipelineService(
      checksRepo,
      analysisResultsRepo,
      stepLogsRepo,
      normalize as unknown as NormalizeTextStep,
      detectDuplicate as unknown as DetectDuplicateStep,
      ruleBasedScan as unknown as RuleBasedScanStep,
      retrieveAiContext as unknown as RetrieveAiContextStep,
      aiAnalysis as unknown as AiAnalysisStep,
      aggregate as unknown as AggregateResultStep,
      persistAiMemory as unknown as PersistAiMemoryStep,
      logger as PinoLogger,
    );
  });

  it('happy path: runs all 7 steps, writes AnalysisResult, invokes persistAiMemory step, marks COMPLETED', async () => {
    checksRepo.getById.mockResolvedValue(buildCheck());
    checksRepo.update.mockResolvedValue(
      buildCheck({ status: ContentRiskCheckStatus.PROCESSING }),
    );
    analysisResultsRepo.create.mockResolvedValue(
      buildAnalysisResult({ checkId: CHECK_ID }),
    );

    normalize.execute.mockResolvedValue(
      ok({ normalizedText: 'hello world' }, normalizeDetails),
    );
    detectDuplicate.execute.mockResolvedValue(
      ok(
        {
          duplicateOfCheckId: null,
          finalAnalysisResult: null,
        },
        dedupeDetails(null),
      ),
    );
    ruleBasedScan.execute.mockResolvedValue(
      ok(
        {
          score: 0,
          flags: [],
          matchedRules: [],
          matchedRulesCount: 0,
          totalRulesChecked: 9,
          flaggedFragments: [],
        },
        ruleDetails,
      ),
    );
    retrieveAiContext.execute.mockResolvedValue(
      ok(
        {
          examples: [],
          embedding: [0.1, 0.2, 0.3],
          embeddingModel: 'openai/text-embedding-3-small',
        },
        retrieveDetails,
      ),
    );
    aiAnalysis.execute.mockResolvedValue(
      ok(
        {
          finalLevel: ContentRiskLevel.LOW,
          categories: [],
          score: 0,
          rationale: 'safe',
          flaggedFragments: [],
        },
        aiDetails,
      ),
    );
    aggregate.execute.mockResolvedValue(
      ok(
        {
          finalRiskLevel: ContentRiskLevel.LOW,
          categories: [],
          matchedRulesCount: 0,
          totalRulesChecked: 9,
          flaggedFragments: [],
          matchedRules: [],
          summary: 'safe',
        },
        aggDetails,
      ),
    );
    persistAiMemory.execute.mockResolvedValue(
      ok({ persisted: true }, persistMemoryDetails),
    );

    await runner.run(CHECK_ID, TRACE_ID);

    expect(normalize.execute).toHaveBeenCalledTimes(1);
    expect(detectDuplicate.execute).toHaveBeenCalledTimes(1);
    expect(ruleBasedScan.execute).toHaveBeenCalledTimes(1);
    expect(retrieveAiContext.execute).toHaveBeenCalledTimes(1);
    expect(aiAnalysis.execute).toHaveBeenCalledTimes(1);
    expect(aggregate.execute).toHaveBeenCalledTimes(1);
    expect(persistAiMemory.execute).toHaveBeenCalledTimes(1);
    expect(persistAiMemory.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        contentHash: 'hash-1',
        embedding: [0.1, 0.2, 0.3],
        embeddingModel: 'openai/text-embedding-3-small',
        finalRiskLevel: ContentRiskLevel.LOW,
        rationale: 'safe',
      }),
      expect.objectContaining({
        checkId: CHECK_ID,
        promptVersionId: PROMPT_ID,
      }),
    );

    expect(analysisResultsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        checkId: CHECK_ID,
        finalRiskLevel: ContentRiskLevel.LOW,
      }),
    );

    expect(checksRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: CHECK_ID,
        status: ContentRiskCheckStatus.COMPLETED,
        duplicateOfCheckId: null,
      }),
    );

    // Each of the 7 step logs gets created (STARTED) and then updated (COMPLETED).
    expect(stepLogsRepo.create).toHaveBeenCalledTimes(7);
    expect(stepLogsRepo.update).toHaveBeenCalledTimes(7);
    for (const call of stepLogsRepo.update.mock.calls) {
      expect(call[1].status).toBe(StepExecutionStatus.COMPLETED);
    }
  });

  it('failure mid-pipeline: only failing step logged FAILED, prior steps COMPLETED, no AnalysisResult written, persistAiMemory not invoked', async () => {
    checksRepo.getById.mockResolvedValue(buildCheck());
    checksRepo.update.mockResolvedValue(buildCheck());

    normalize.execute.mockResolvedValue(
      ok({ normalizedText: 'hello world' }, normalizeDetails),
    );
    detectDuplicate.execute.mockResolvedValue(
      ok(
        {
          duplicateOfCheckId: null,
          finalAnalysisResult: null,
        },
        dedupeDetails(null),
      ),
    );
    ruleBasedScan.execute.mockResolvedValue(
      ok(
        {
          score: 0,
          flags: [],
          matchedRules: [],
          matchedRulesCount: 0,
          totalRulesChecked: 9,
          flaggedFragments: [],
        },
        ruleDetails,
      ),
    );
    retrieveAiContext.execute.mockResolvedValue(
      ok(
        {
          examples: [],
          embedding: [0.1, 0.2],
          embeddingModel: 'openai/text-embedding-3-small',
        },
        retrieveDetails,
      ),
    );
    aiAnalysis.execute.mockResolvedValue(
      fail('AI_VALIDATION_FAILED', 'invalid', aiDetails),
    );

    await expect(runner.run(CHECK_ID, TRACE_ID)).rejects.toBeInstanceOf(
      PipelineFailedError,
    );

    expect(aggregate.execute).not.toHaveBeenCalled();
    expect(persistAiMemory.execute).not.toHaveBeenCalled();
    expect(analysisResultsRepo.create).not.toHaveBeenCalled();

    // No COMPLETED finalize update was attempted.
    const finalizeCalls = checksRepo.update.mock.calls.filter(
      (c) => c[0].status === ContentRiskCheckStatus.COMPLETED,
    );
    expect(finalizeCalls).toHaveLength(0);

    // Step log update statuses: 4 COMPLETED (normalize, detectDuplicate, ruleScan, retrieveAiContext)
    // and 1 FAILED (aiAnalysis).
    const updateStatuses = stepLogsRepo.update.mock.calls.map(
      (c) => c[1].status,
    );
    expect(
      updateStatuses.filter((s) => s === StepExecutionStatus.COMPLETED),
    ).toHaveLength(4);
    expect(
      updateStatuses.filter((s) => s === StepExecutionStatus.FAILED),
    ).toHaveLength(1);

    const failedCall = stepLogsRepo.update.mock.calls.find(
      (c) => c[1].status === StepExecutionStatus.FAILED,
    );
    expect(failedCall?.[1].errorMessage).toContain('AI_VALIDATION_FAILED');
  });

  it('DetectDuplicate skip path: rule/ai/aggregate/persist steps NOT called, runner copies winner result, COMPLETED with duplicateOfCheckId', async () => {
    checksRepo.getById.mockResolvedValue(buildCheck());
    checksRepo.update.mockResolvedValue(buildCheck());

    const winnerResult = buildAnalysisResult();
    analysisResultsRepo.create.mockResolvedValue(
      buildAnalysisResult({ checkId: CHECK_ID }),
    );

    normalize.execute.mockResolvedValue(
      ok({ normalizedText: 'hello world' }, normalizeDetails),
    );
    detectDuplicate.execute.mockResolvedValue(
      ok(
        {
          duplicateOfCheckId: WINNER_ID,
          finalAnalysisResult: winnerResult,
        },
        dedupeDetails(WINNER_ID),
      ),
    );

    await runner.run(CHECK_ID, TRACE_ID);

    expect(ruleBasedScan.execute).not.toHaveBeenCalled();
    expect(retrieveAiContext.execute).not.toHaveBeenCalled();
    expect(aiAnalysis.execute).not.toHaveBeenCalled();
    expect(aggregate.execute).not.toHaveBeenCalled();
    expect(persistAiMemory.execute).not.toHaveBeenCalled();

    // Only normalize + detectDuplicate logged (2 step logs created).
    expect(stepLogsRepo.create).toHaveBeenCalledTimes(2);
    const stepNamesLogged = stepLogsRepo.create.mock.calls.map(
      (c) => c[0].stepName,
    );
    expect(stepNamesLogged).toEqual([
      ContentRiskStepName.NORMALIZE_TEXT,
      ContentRiskStepName.DETECT_DUPLICATE,
    ]);

    // Runner now performs the copy of the winner's analysis result.
    expect(analysisResultsRepo.create).toHaveBeenCalledTimes(1);
    expect(analysisResultsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        checkId: CHECK_ID,
        finalRiskLevel: winnerResult.finalRiskLevel,
        categories: winnerResult.categories,
        matchedRulesCount: winnerResult.matchedRulesCount,
        totalRulesChecked: winnerResult.totalRulesChecked,
        summary: winnerResult.summary,
      }),
    );

    expect(checksRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: CHECK_ID,
        status: ContentRiskCheckStatus.COMPLETED,
        duplicateOfCheckId: WINNER_ID,
      }),
    );
  });

  it('DetectDuplicate copy failure: throws PipelineFailedError(DETECT_DUPLICATE, COPY_RESULT_FAILED)', async () => {
    checksRepo.getById.mockResolvedValue(buildCheck());
    checksRepo.update.mockResolvedValue(buildCheck());

    const winnerResult = buildAnalysisResult();
    analysisResultsRepo.create.mockResolvedValue(new Error('insert failed'));

    normalize.execute.mockResolvedValue(
      ok({ normalizedText: 'hello world' }, normalizeDetails),
    );
    detectDuplicate.execute.mockResolvedValue(
      ok(
        {
          duplicateOfCheckId: WINNER_ID,
          finalAnalysisResult: winnerResult,
        },
        dedupeDetails(WINNER_ID),
      ),
    );

    let thrown: unknown;
    try {
      await runner.run(CHECK_ID, TRACE_ID);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(PipelineFailedError);
    const err = thrown as PipelineFailedError;
    expect(err.stepName).toBe(ContentRiskStepName.DETECT_DUPLICATE);
    expect(err.errorCode).toBe('COPY_RESULT_FAILED');

    // Pipeline did not finalize.
    const finalizeCalls = checksRepo.update.mock.calls.filter(
      (c) => c[0].status === ContentRiskCheckStatus.COMPLETED,
    );
    expect(finalizeCalls).toHaveLength(0);
    expect(persistAiMemory.execute).not.toHaveBeenCalled();
  });

  it('race fallback: P2002 on finalize → copy winner result, set duplicateOfCheckId to winner', async () => {
    checksRepo.getById.mockResolvedValue(buildCheck());

    normalize.execute.mockResolvedValue(
      ok({ normalizedText: 'hello world' }, normalizeDetails),
    );
    detectDuplicate.execute.mockResolvedValue(
      ok(
        {
          duplicateOfCheckId: null,
          finalAnalysisResult: null,
        },
        dedupeDetails(null),
      ),
    );
    ruleBasedScan.execute.mockResolvedValue(
      ok(
        {
          score: 0,
          flags: [],
          matchedRules: [],
          matchedRulesCount: 0,
          totalRulesChecked: 9,
          flaggedFragments: [],
        },
        ruleDetails,
      ),
    );
    retrieveAiContext.execute.mockResolvedValue(
      ok(
        {
          examples: [],
          embedding: [0.1, 0.2],
          embeddingModel: 'openai/text-embedding-3-small',
        },
        retrieveDetails,
      ),
    );
    aiAnalysis.execute.mockResolvedValue(
      ok(
        {
          finalLevel: ContentRiskLevel.LOW,
          categories: [],
          score: 0,
          rationale: 'safe',
          flaggedFragments: [],
        },
        aiDetails,
      ),
    );
    aggregate.execute.mockResolvedValue(
      ok(
        {
          finalRiskLevel: ContentRiskLevel.LOW,
          categories: [],
          matchedRulesCount: 0,
          totalRulesChecked: 9,
          flaggedFragments: [],
          matchedRules: [],
          summary: 'safe',
        },
        aggDetails,
      ),
    );
    persistAiMemory.execute.mockResolvedValue(
      ok({ persisted: true }, persistMemoryDetails),
    );

    analysisResultsRepo.create.mockResolvedValue(
      buildAnalysisResult({ checkId: CHECK_ID }),
    );
    analysisResultsRepo.delete.mockResolvedValue(undefined);

    const winnerResult = buildAnalysisResult({
      checkId: WINNER_ID,
      finalRiskLevel: ContentRiskLevel.HIGH,
      summary: 'winner summary',
    });
    const winnerCheck = buildCheck({
      id: WINNER_ID,
      status: ContentRiskCheckStatus.COMPLETED,
    });
    checksRepo.findActiveByContentHash.mockResolvedValue(winnerCheck);
    analysisResultsRepo.getByCheckId.mockResolvedValue(winnerResult);

    // Sequence of checksRepo.update calls:
    //   1. set PROCESSING (loadAndPrepareCheck)
    //   2..8. currentStep updates per step (7 steps)
    //   9. final finalize → throw P2002
    //   10. refinalize with duplicateOfCheckId = winner.id
    let updateCount = 0;
    type UpdateInput = Parameters<ContentRiskChecksRepository['update']>[0];
    checksRepo.update.mockImplementation((data: UpdateInput) => {
      updateCount += 1;
      if (
        data.status === ContentRiskCheckStatus.COMPLETED &&
        updateCount === 9
      ) {
        const err: Error & { code?: string } = new Error(
          'unique constraint violation',
        );
        err.code = 'P2002';
        return Promise.reject(err);
      }
      return Promise.resolve(buildCheck({ ...data }));
    });

    await runner.run(CHECK_ID, TRACE_ID);

    // Race fallback: own analysis result is deleted, then winner's is copied.
    expect(analysisResultsRepo.delete).toHaveBeenCalledWith(CHECK_ID);
    expect(analysisResultsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        checkId: CHECK_ID,
        finalRiskLevel: winnerResult.finalRiskLevel,
        summary: winnerResult.summary,
      }),
    );

    // Final state: COMPLETED with duplicateOfCheckId pointing at winner.
    const refinalize = checksRepo.update.mock.calls.find(
      (c) =>
        c[0].status === ContentRiskCheckStatus.COMPLETED &&
        c[0].duplicateOfCheckId === WINNER_ID,
    );
    expect(refinalize).toBeDefined();
  });
});
