import { Injectable } from '@nestjs/common';
import { ContentRiskCategory } from '../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { ContentRiskStepName } from '../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { AiAnalysisOutput } from '../../../../../domain/content-risk-checks/schemas/ai-output.schema';
import { PipelineStep } from '../contracts/pipeline-step.interface';
import { StepContext } from '../contracts/step-context.type';
import { StepResult } from '../contracts/step-result.type';

interface MatchedRule {
  ruleId: string;
  category: ContentRiskCategory;
  fragments: Array<{ fragment: string }>;
}

interface FlaggedFragment {
  text: string;
  reason: string;
}

interface AggregateInput {
  ruleResult: {
    score: number;
    flags: ContentRiskCategory[];
    matchedRules: MatchedRule[];
    matchedRulesCount: number;
    totalRulesChecked: number;
    flaggedFragments: FlaggedFragment[];
  };
  aiResult: AiAnalysisOutput;
}

interface AggregatedAnalysisResult {
  finalRiskLevel: ContentRiskLevel;
  categories: ContentRiskCategory[];
  matchedRulesCount: number;
  totalRulesChecked: number;
  flaggedFragments: FlaggedFragment[];
  matchedRules: unknown;
  summary: string;
}

const LEVEL_RANK: Record<ContentRiskLevel, number> = {
  [ContentRiskLevel.LOW]: 0,
  [ContentRiskLevel.MEDIUM]: 1,
  [ContentRiskLevel.HIGH]: 2,
};

@Injectable()
export class AggregateResultStep implements PipelineStep<
  AggregateInput,
  AggregatedAnalysisResult
> {
  readonly name = ContentRiskStepName.AGGREGATE_RESULT;

  execute(
    input: AggregateInput,
    _ctx: StepContext,
  ): Promise<StepResult<AggregatedAnalysisResult>> {
    try {
      const ruleScore = input.ruleResult.score;
      const aiScore = input.aiResult.score;
      const finalScore = 0.4 * ruleScore + 0.6 * aiScore;

      const thresholdLevel: ContentRiskLevel =
        finalScore < 0.34
          ? ContentRiskLevel.LOW
          : finalScore < 0.67
            ? ContentRiskLevel.MEDIUM
            : ContentRiskLevel.HIGH;

      const finalLevel =
        LEVEL_RANK[input.aiResult.finalLevel] > LEVEL_RANK[thresholdLevel]
          ? input.aiResult.finalLevel
          : thresholdLevel;

      const categories = [
        ...new Set([...input.aiResult.categories, ...input.ruleResult.flags]),
      ];

      const flaggedFragments: FlaggedFragment[] = [
        ...input.aiResult.flaggedFragments.map((f) => ({
          text: f.text,
          reason: f.reason,
        })),
        ...input.ruleResult.flaggedFragments,
      ];

      return Promise.resolve({
        ok: true,
        output: {
          finalRiskLevel: finalLevel,
          categories,
          matchedRulesCount: input.ruleResult.matchedRulesCount,
          totalRulesChecked: input.ruleResult.totalRulesChecked,
          flaggedFragments,
          matchedRules: input.ruleResult.matchedRules,
          summary: input.aiResult.rationale,
        },
        details: {
          stepName: ContentRiskStepName.AGGREGATE_RESULT,
          ruleScore,
          aiScore,
          finalScore,
          finalLevel,
        },
      });
    } catch (err) {
      return Promise.resolve({
        ok: false,
        error: { code: 'AGGREGATE_FAILED', message: (err as Error).message },
        details: {
          stepName: ContentRiskStepName.AGGREGATE_RESULT,
          ruleScore: 0,
          aiScore: 0,
          finalScore: 0,
          finalLevel: ContentRiskLevel.LOW,
        },
      });
    }
  }
}
