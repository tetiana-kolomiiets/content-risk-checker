import { Injectable } from '@nestjs/common';
import { ContentRiskCategory } from '../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { ContentRiskStepName } from '../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { AiAnalysisOutput } from '../../../../../domain/content-risk-checks/schemas/ai-output.schema';
import { PipelineStep } from '../contracts/pipeline-step.interface';
import { StepContext } from '../contracts/step-context.type';
import { StepResult } from '../contracts/step-result.type';

// =====================================================================
// PLACEHOLDER IMPLEMENTATION
// TODO(Stage 3 / Prompt 17): replace with real OpenRouter call.
// Returns deterministic output based on rule flags so the rest of the
// pipeline can be exercised end-to-end without network calls.
// =====================================================================

interface AiAnalysisInput {
  normalizedText: string;
  ruleFlags: ContentRiskCategory[];
}

@Injectable()
export class AiAnalysisStep
  implements PipelineStep<AiAnalysisInput, AiAnalysisOutput>
{
  readonly name = ContentRiskStepName.RUN_AI_ANALYSIS;

  async execute(
    input: AiAnalysisInput,
    _ctx: StepContext,
  ): Promise<StepResult<AiAnalysisOutput>> {
    const severeCategories = [
      ContentRiskCategory.THREAT,
      ContentRiskCategory.SELF_HARM,
      ContentRiskCategory.HATE,
    ];
    const hasSevere = input.ruleFlags.some((f) =>
      severeCategories.includes(f),
    );
    const hasAny = input.ruleFlags.length > 0;

    let finalLevel: ContentRiskLevel;
    let score: number;
    if (hasSevere) {
      finalLevel = ContentRiskLevel.HIGH;
      score = 0.85;
    } else if (hasAny) {
      finalLevel = ContentRiskLevel.MEDIUM;
      score = 0.5;
    } else {
      finalLevel = ContentRiskLevel.LOW;
      score = 0.1;
    }

    const output: AiAnalysisOutput = {
      finalLevel,
      categories: input.ruleFlags,
      score,
      rationale:
        'Placeholder AI response. Real OpenRouter integration pending.',
      flaggedFragments: [],
    };

    return {
      ok: true,
      output,
      details: {
        stepName: ContentRiskStepName.RUN_AI_ANALYSIS,
        promptVersion: 1,
        tokensIn: 0,
        tokensOut: 0,
      },
    };
  }
}
