import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { isPrismaUniqueConstraintError } from '../../../common/utils/prisma-errors';
import { ContentRiskCheckStatus } from '../../../domain/content-risk-checks/enums/content-risk-check-status.enum';
import { ContentRiskStepName } from '../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { StepExecutionStatus } from '../../../domain/content-risk-checks/enums/step-execution-status.enum';
import { StepDetailsSchema } from '../../../domain/content-risk-checks/schemas/step-details.schema';
import {
  CONTENT_RISK_ANALYSIS_RESULTS_REPOSITORY,
  ContentRiskAnalysisResultsRepository,
} from '../../../infrastructure/postgres/ports/content-risk-analysis-results.repository';
import {
  CONTENT_RISK_CHECKS_REPOSITORY,
  ContentRiskChecksRepository,
} from '../../../infrastructure/postgres/ports/content-risk-checks.repository';
import {
  CONTENT_RISK_STEP_LOGS_REPOSITORY,
  ContentRiskStepLogsRepository,
} from '../../../infrastructure/postgres/ports/content-risk-step-logs.repository';
import { PipelineFailedError } from './pipeline/contracts/pipeline-error';
import { PipelineStep } from './pipeline/contracts/pipeline-step.interface';
import { StepContext } from './pipeline/contracts/step-context.type';
import { StepResult } from './pipeline/contracts/step-result.type';
import { AggregateResultStep } from './pipeline/steps/aggregate-result.step';
import { AiAnalysisStep } from './pipeline/steps/ai-analysis.step';
import { DetectDuplicateStep } from './pipeline/steps/detect-duplicate.step';
import { NormalizeTextStep } from './pipeline/steps/normalize-text.step';
import { RuleBasedScanStep } from './pipeline/steps/rule-based-scan.step';

@Injectable()
export class ContentRiskChecksPipelineService {
  constructor(
    @Inject(CONTENT_RISK_CHECKS_REPOSITORY)
    private readonly checksRepo: ContentRiskChecksRepository,
    @Inject(CONTENT_RISK_ANALYSIS_RESULTS_REPOSITORY)
    private readonly analysisResultsRepo: ContentRiskAnalysisResultsRepository,
    @Inject(CONTENT_RISK_STEP_LOGS_REPOSITORY)
    private readonly stepLogsRepo: ContentRiskStepLogsRepository,
    private readonly normalize: NormalizeTextStep,
    private readonly detectDuplicate: DetectDuplicateStep,
    private readonly ruleBasedScan: RuleBasedScanStep,
    private readonly aiAnalysis: AiAnalysisStep,
    private readonly aggregate: AggregateResultStep,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext('PipelineRunner');
  }

  async run(checkId: string, traceId: string): Promise<void> {
    const check = await this.loadAndPrepareCheck(checkId);
    const ctx: StepContext = {
      checkId,
      traceId,
      promptVersionId: check.promptVersionId!,
    };
    const attempt = check.retryCount + 1;

    const normalizeOutput = await this.executeStep(
      this.normalize,
      { rawText: check.rawText },
      ctx,
      attempt,
    );

    const dedupeOutput = await this.executeStep(
      this.detectDuplicate,
      { contentHash: check.contentHash, selfId: check.id },
      ctx,
      attempt,
    );

    const ranOwnAnalysis = dedupeOutput.duplicateOfCheckId === null;

    if (!ranOwnAnalysis) {
      this.logger.info(
        { duplicateOfCheckId: dedupeOutput.duplicateOfCheckId, checkId },
        'Duplicate detected, skipping pipeline',
      );
    } else {
      const ruleOutput = await this.executeStep(
        this.ruleBasedScan,
        { normalizedText: normalizeOutput.normalizedText },
        ctx,
        attempt,
      );

      const aiOutput = await this.executeStep(
        this.aiAnalysis,
        {
          normalizedText: normalizeOutput.normalizedText,
          ruleFlags: ruleOutput.flags,
          examples: [],
        },
        ctx,
        attempt,
      );

      const aggregatedOutput = await this.executeStep(
        this.aggregate,
        { ruleResult: ruleOutput, aiResult: aiOutput },
        ctx,
        attempt,
      );

      const created = await this.analysisResultsRepo.create({
        checkId,
        finalRiskLevel: aggregatedOutput.finalRiskLevel,
        categories: aggregatedOutput.categories,
        matchedRulesCount: aggregatedOutput.matchedRulesCount,
        totalRulesChecked: aggregatedOutput.totalRulesChecked,
        flaggedFragments: aggregatedOutput.flaggedFragments,
        matchedRules: aggregatedOutput.matchedRules,
        summary: aggregatedOutput.summary,
      });
      if (created instanceof Error) {
        throw new PipelineFailedError(
          ContentRiskStepName.AGGREGATE_RESULT,
          'PERSIST_RESULT_FAILED',
          created.message,
        );
      }
    }

    await this.finalizeCompleted(
      checkId,
      check.contentHash,
      check.promptVersionId!,
      dedupeOutput.duplicateOfCheckId,
      ranOwnAnalysis,
    );

    this.logger.info({ checkId, status: 'COMPLETED' }, 'Pipeline completed');
  }

  private async finalizeCompleted(
    checkId: string,
    contentHash: string,
    promptVersionId: string,
    duplicateOfCheckId: string | null,
    ranOwnAnalysis: boolean,
  ): Promise<void> {
    try {
      const finalized = await this.checksRepo.update({
        id: checkId,
        status: ContentRiskCheckStatus.COMPLETED,
        currentStep: null,
        finishedAt: new Date(),
        replayOfCheckId: duplicateOfCheckId,
      });
      if (finalized instanceof Error) {
        throw new PipelineFailedError(
          ContentRiskStepName.AGGREGATE_RESULT,
          'FINALIZE_FAILED',
          finalized.message,
        );
      }
      return;
    } catch (err) {
      if (!isPrismaUniqueConstraintError(err)) throw err;
    }

    // Race lost: another concurrent pipeline finalized first. Adopt its result.
    const winnerLookup = await this.checksRepo.findActiveByContentHash(
      contentHash,
      promptVersionId,
    );
    if (winnerLookup instanceof Error) {
      throw new PipelineFailedError(
        ContentRiskStepName.AGGREGATE_RESULT,
        'FINALIZE_RACE_LOOKUP_FAILED',
        winnerLookup.message,
      );
    }
    if (!winnerLookup || winnerLookup.id === checkId) {
      throw new PipelineFailedError(
        ContentRiskStepName.AGGREGATE_RESULT,
        'FINALIZE_RACE_NO_WINNER',
        'P2002 raised but no winning check found',
      );
    }
    const winner = winnerLookup;

    const winnerResult = await this.analysisResultsRepo.getByCheckId(winner.id);
    if (winnerResult instanceof Error || !winnerResult) {
      throw new PipelineFailedError(
        ContentRiskStepName.AGGREGATE_RESULT,
        'FINALIZE_RACE_WINNER_RESULT_MISSING',
        `Winner check ${winner.id} has no analysis result`,
      );
    }

    if (ranOwnAnalysis) {
      const deleted = await this.analysisResultsRepo.delete(checkId);
      if (deleted instanceof Error) {
        throw new PipelineFailedError(
          ContentRiskStepName.AGGREGATE_RESULT,
          'FINALIZE_RACE_DELETE_FAILED',
          deleted.message,
        );
      }
      const copied = await this.analysisResultsRepo.create({
        checkId,
        finalRiskLevel: winnerResult.finalRiskLevel,
        categories: winnerResult.categories,
        matchedRulesCount: winnerResult.matchedRulesCount,
        totalRulesChecked: winnerResult.totalRulesChecked,
        flaggedFragments: winnerResult.flaggedFragments,
        matchedRules: winnerResult.matchedRules,
        summary: winnerResult.summary,
      });
      if (copied instanceof Error) {
        throw new PipelineFailedError(
          ContentRiskStepName.AGGREGATE_RESULT,
          'FINALIZE_RACE_COPY_FAILED',
          copied.message,
        );
      }
    }

    const refinalized = await this.checksRepo.update({
      id: checkId,
      status: ContentRiskCheckStatus.COMPLETED,
      currentStep: null,
      finishedAt: new Date(),
      replayOfCheckId: winner.id,
    });
    if (refinalized instanceof Error) {
      throw new PipelineFailedError(
        ContentRiskStepName.AGGREGATE_RESULT,
        'FINALIZE_RACE_REFINALIZE_FAILED',
        refinalized.message,
      );
    }

    this.logger.info(
      { winnerCheckId: winner.id, loserCheckId: checkId },
      'Race lost on finalize, copied winner result',
    );
  }

  private async loadAndPrepareCheck(checkId: string) {
    const check = await this.checksRepo.getById(checkId);
    if (check instanceof Error) {
      throw new Error(`Failed to load check: ${check.message}`);
    }
    if (!check) {
      throw new Error(`Check ${checkId} not found`);
    }
    if (
      check.status !== ContentRiskCheckStatus.PENDING &&
      check.status !== ContentRiskCheckStatus.PROCESSING
    ) {
      throw new Error(
        `Check ${checkId} is in status ${check.status}, cannot run pipeline`,
      );
    }
    if (!check.promptVersionId) {
      throw new Error(`Check ${checkId} has no promptVersionId`);
    }

    const updated = await this.checksRepo.update({
      id: checkId,
      status: ContentRiskCheckStatus.PROCESSING,
      startedAt: check.startedAt ?? new Date(),
    });
    if (updated instanceof Error) {
      throw new Error(`Failed to set PROCESSING: ${updated.message}`);
    }
    return updated;
  }

  private async executeStep<I, O>(
    step: PipelineStep<I, O>,
    input: I,
    ctx: StepContext,
    attempt: number,
  ): Promise<O> {
    await this.checksRepo.update({
      id: ctx.checkId,
      currentStep: step.name,
    });

    const started = await this.stepLogsRepo.create({
      checkId: ctx.checkId,
      traceId: ctx.traceId,
      stepName: step.name,
      status: StepExecutionStatus.STARTED,
      attempt,
      startedAt: new Date(),
    });
    if (started instanceof Error) {
      throw new PipelineFailedError(
        step.name,
        'STEP_LOG_CREATE_FAILED',
        started.message,
      );
    }

    const startMs = Date.now();
    let result: StepResult<O>;
    try {
      result = await step.execute(input, ctx);
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const message = (err as Error).message;
      await this.stepLogsRepo.update(started.id, {
        status: StepExecutionStatus.FAILED,
        finishedAt: new Date(),
        durationMs,
        errorMessage: `STEP_THREW: ${message}`,
      });
      throw new PipelineFailedError(step.name, 'STEP_THREW', message);
    }
    const durationMs = Date.now() - startMs;

    const detailsParsed = StepDetailsSchema.safeParse(result.details);
    const details = detailsParsed.success
      ? detailsParsed.data
      : { stepName: step.name, _zodError: detailsParsed.error.message };

    if (result.ok) {
      await this.stepLogsRepo.update(started.id, {
        status: StepExecutionStatus.COMPLETED,
        finishedAt: new Date(),
        durationMs,
        details,
      });
      return result.output;
    }

    await this.stepLogsRepo.update(started.id, {
      status: StepExecutionStatus.FAILED,
      finishedAt: new Date(),
      durationMs,
      details,
      errorMessage: `${result.error.code}: ${result.error.message}`,
    });
    throw new PipelineFailedError(
      step.name,
      result.error.code,
      result.error.message,
    );
  }
}
