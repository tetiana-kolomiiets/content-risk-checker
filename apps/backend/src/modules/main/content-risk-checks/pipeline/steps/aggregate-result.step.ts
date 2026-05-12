import { Injectable } from '@nestjs/common';
import {
  AI_SCORE_WEIGHT,
  HIGH_RISK_THRESHOLD,
  MEDIUM_RISK_THRESHOLD,
  RULE_SCORE_WEIGHT,
} from '../../../../../infrastructure/config/scoring.constants';
import { ContentRiskCategory } from '../../../../../shared/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../../../shared/enums/content-risk-level.enum';
import { ContentRiskStepName } from '../../../../../shared/enums/content-risk-step-name.enum';
import { AiAnalysisOutput } from '../../../../../shared/schemas/ai-output.schema';
import { FlaggedFragment } from '../../../../../shared/schemas/flagged-fragment.schema';
import { MatchedRule } from '../../../../../shared/schemas/matched-rule.schema';
import { PipelineStep } from '../contracts/pipeline-step.interface';
import { StepContext } from '../contracts/step-context.type';
import { StepResult } from '../contracts/step-result.type';

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
  matchedRules: MatchedRule[];
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
      const finalScore =
        RULE_SCORE_WEIGHT * ruleScore + AI_SCORE_WEIGHT * aiScore;

      const thresholdLevel: ContentRiskLevel =
        finalScore < MEDIUM_RISK_THRESHOLD
          ? ContentRiskLevel.LOW
          : finalScore < HIGH_RISK_THRESHOLD
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
