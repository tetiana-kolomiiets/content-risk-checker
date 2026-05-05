import { Inject, Injectable } from '@nestjs/common';
import { ContentRiskStepName } from '../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { ContentRiskAnalysisResult } from '../../../../../domain/content-risk-checks/types/content-risk-analysis-result.type';
import {
  CONTENT_RISK_ANALYSIS_RESULTS_REPOSITORY,
  ContentRiskAnalysisResultsRepository,
} from '../../../../../infrastructure/postgres/ports/content-risk-analysis-results.repository';
import {
  CONTENT_RISK_CHECKS_REPOSITORY,
  ContentRiskChecksRepository,
} from '../../../../../infrastructure/postgres/ports/content-risk-checks.repository';
import { PipelineStep } from '../contracts/pipeline-step.interface';
import { StepContext } from '../contracts/step-context.type';
import { StepResult } from '../contracts/step-result.type';

interface DetectDuplicateInput {
  contentHash: string;
  selfId: string;
}

interface DetectDuplicateOutput {
  duplicateOfCheckId: string | null;
  copiedAnalysisResultId: string | null;
  finalAnalysisResult: ContentRiskAnalysisResult | null;
}

@Injectable()
export class DetectDuplicateStep
  implements PipelineStep<DetectDuplicateInput, DetectDuplicateOutput>
{
  readonly name = ContentRiskStepName.DETECT_DUPLICATE;

  constructor(
    @Inject(CONTENT_RISK_CHECKS_REPOSITORY)
    private readonly checksRepo: ContentRiskChecksRepository,
    @Inject(CONTENT_RISK_ANALYSIS_RESULTS_REPOSITORY)
    private readonly analysisResultsRepo: ContentRiskAnalysisResultsRepository,
  ) {}

  async execute(
    input: DetectDuplicateInput,
    ctx: StepContext,
  ): Promise<StepResult<DetectDuplicateOutput>> {
    const found = await this.checksRepo.findActiveByContentHash(
      input.contentHash,
      ctx.promptVersionId,
    );

    if (found instanceof Error) {
      return this.fail('DEDUP_LOOKUP_FAILED', found.message);
    }

    if (!found || found.id === input.selfId) {
      return {
        ok: true,
        output: {
          duplicateOfCheckId: null,
          copiedAnalysisResultId: null,
          finalAnalysisResult: null,
        },
        details: {
          stepName: ContentRiskStepName.DETECT_DUPLICATE,
          duplicateOfCheckId: null,
        },
      };
    }

    const sourceResult = await this.analysisResultsRepo.getByCheckId(found.id);
    if (sourceResult instanceof Error || !sourceResult) {
      return this.fail(
        'DEDUP_SOURCE_RESULT_MISSING',
        `Source check ${found.id} has no analysis result`,
      );
    }

    const copied = await this.analysisResultsRepo.create({
      checkId: input.selfId,
      finalRiskLevel: sourceResult.finalRiskLevel,
      categories: sourceResult.categories,
      matchedRulesCount: sourceResult.matchedRulesCount,
      totalRulesChecked: sourceResult.totalRulesChecked,
      flaggedFragments: sourceResult.flaggedFragments,
      matchedRules: sourceResult.matchedRules,
      summary: sourceResult.summary,
    });

    if (copied instanceof Error) {
      return this.fail('DEDUP_COPY_FAILED', copied.message);
    }

    return {
      ok: true,
      output: {
        duplicateOfCheckId: found.id,
        copiedAnalysisResultId: copied.id,
        finalAnalysisResult: sourceResult,
      },
      details: {
        stepName: ContentRiskStepName.DETECT_DUPLICATE,
        duplicateOfCheckId: found.id,
      },
      skipRemaining: true,
    };
  }

  private fail(
    code: string,
    message: string,
  ): StepResult<DetectDuplicateOutput> {
    return {
      ok: false,
      error: { code, message },
      details: {
        stepName: ContentRiskStepName.DETECT_DUPLICATE,
        duplicateOfCheckId: null,
      },
    };
  }
}
