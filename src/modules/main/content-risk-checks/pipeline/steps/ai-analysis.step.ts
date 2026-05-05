import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ContentRiskCategory } from '../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskStepName } from '../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import {
  AiAnalysisOutput,
  AiAnalysisOutputSchema,
} from '../../../../../domain/content-risk-checks/schemas/ai-output.schema';
import { AiFewShotExample } from '../../../../../domain/content-risk-checks/types/ai-few-shot-example.type';
import {
  LLM_CLIENT,
  LlmClient,
  LlmCompletionOutput,
} from '../../../../../infrastructure/llm/llm.types';
import {
  PROMPTS_REPOSITORY,
  PromptsRepository,
} from '../../../../../infrastructure/postgres/ports/prompts.repository';
import { PipelineStep } from '../contracts/pipeline-step.interface';
import { StepContext } from '../contracts/step-context.type';
import { StepResult } from '../contracts/step-result.type';

interface AiAnalysisInput {
  normalizedText: string;
  ruleFlags: ContentRiskCategory[];
  examples: AiFewShotExample[];
}

@Injectable()
export class AiAnalysisStep implements PipelineStep<
  AiAnalysisInput,
  AiAnalysisOutput
> {
  readonly name = ContentRiskStepName.RUN_AI_ANALYSIS;

  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    @Inject(PROMPTS_REPOSITORY) private readonly promptsRepo: PromptsRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AiAnalysisStep.name);
  }

  async execute(
    input: AiAnalysisInput,
    ctx: StepContext,
  ): Promise<StepResult<AiAnalysisOutput>> {
    const promptOrErr = await this.promptsRepo.getById(ctx.promptVersionId);
    if (promptOrErr instanceof Error) {
      return this.fail('PROMPT_LOOKUP_FAILED', promptOrErr.message, 0);
    }
    if (!promptOrErr) {
      return this.fail(
        'PROMPT_NOT_FOUND',
        `Prompt ${ctx.promptVersionId} not found`,
        0,
      );
    }

    let system: string;
    let userTemplate: string;
    try {
      const parsed = JSON.parse(promptOrErr.template) as {
        system: string;
        userTemplate: string;
      };
      system = parsed.system;
      userTemplate = parsed.userTemplate;
    } catch (e) {
      return this.fail(
        'PROMPT_TEMPLATE_INVALID',
        (e as Error).message,
        promptOrErr.version,
      );
    }

    const examplesSection =
      input.examples.length === 0
        ? ''
        : 'Past similar decisions for reference:\n\n' +
          input.examples
            .map(
              (e, i) =>
                `Example ${i + 1} (similarity ${(e.similarity * 100).toFixed(0)}%):\n` +
                `- Text: "${e.contentSnippet}"\n` +
                `- Decision: ${e.finalRiskLevel}; categories: ${e.categories.join(', ')}\n` +
                `- Reasoning: ${e.rationale}`,
            )
            .join('\n\n') +
          '\n\n';

    const userText = userTemplate
      .replace('{examples_section}', examplesSection)
      .replace('{text}', input.normalizedText)
      .replace('{rule_flags}', input.ruleFlags.join(', ') || 'none');

    let lastError: string | null = null;
    let totalTokensIn = 0;
    let totalTokensOut = 0;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const userMessage =
        attempt === 1
          ? userText
          : `${userText}\n\nYour previous response failed validation: ${lastError}.\nReturn ONLY valid JSON matching the schema. No prose, no markdown fences.`;

      let llmResp: LlmCompletionOutput;
      try {
        llmResp = await this.llm.complete({
          system,
          user: userMessage,
          model: promptOrErr.model,
          temperature: 0,
        });
      } catch (e) {
        return this.fail(
          'LLM_CALL_FAILED',
          (e as Error).message,
          promptOrErr.version,
          totalTokensIn,
          totalTokensOut,
        );
      }

      totalTokensIn += llmResp.tokensIn;
      totalTokensOut += llmResp.tokensOut;

      let parsed: unknown;
      try {
        parsed = JSON.parse(llmResp.content);
      } catch (e) {
        lastError = `JSON.parse failed: ${(e as Error).message}`;
        continue;
      }

      const zodResult = AiAnalysisOutputSchema.safeParse(parsed);
      if (!zodResult.success) {
        lastError = zodResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        this.logger.warn(
          { checkId: ctx.checkId, attempt, lastError },
          'AI response failed schema validation',
        );
        continue;
      }

      return {
        ok: true,
        output: zodResult.data,
        details: {
          stepName: ContentRiskStepName.RUN_AI_ANALYSIS,
          promptVersion: promptOrErr.version,
          tokensIn: totalTokensIn,
          tokensOut: totalTokensOut,
          attempts: attempt,
        },
      };
    }

    return this.fail(
      'AI_VALIDATION_FAILED',
      `Failed schema validation after 2 attempts. Last error: ${lastError}`,
      promptOrErr.version,
      totalTokensIn,
      totalTokensOut,
    );
  }

  private fail(
    code: string,
    message: string,
    promptVersion: number,
    tokensIn = 0,
    tokensOut = 0,
  ): StepResult<AiAnalysisOutput> {
    return {
      ok: false,
      error: { code, message },
      details: {
        stepName: ContentRiskStepName.RUN_AI_ANALYSIS,
        promptVersion,
        tokensIn,
        tokensOut,
      },
    };
  }
}
