import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { EnvConfig } from '../../../../../config/env.schema';
import { ContentRiskCategory } from '../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskStepName } from '../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import {
  AiAnalysisOutput,
  AiAnalysisOutputSchema,
} from '../../../../../domain/content-risk-checks/schemas/ai-output.schema';
import { AiFewShotExample } from '../../../../../domain/content-risk-checks/schemas/ai-few-shot-example.schema';
import { Prompt } from '../../../../../domain/content-risk-checks/types/prompt.type';
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
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AiAnalysisStep.name);
  }

  async execute(
    input: AiAnalysisInput,
    ctx: StepContext,
  ): Promise<StepResult<AiAnalysisOutput>> {
    let prompt: Prompt | null;
    try {
      prompt = await this.promptsRepo.getById(ctx.promptVersionId);
    } catch (err) {
      return this.fail('PROMPT_LOOKUP_FAILED', (err as Error).message, 0);
    }
    if (!prompt) {
      return this.fail(
        'PROMPT_NOT_FOUND',
        `Prompt ${ctx.promptVersionId} not found`,
        0,
      );
    }

    let system: string;
    let userTemplate: string;
    try {
      const parsed = JSON.parse(prompt.template) as {
        system: string;
        userTemplate: string;
      };
      system = parsed.system;
      userTemplate = parsed.userTemplate;
    } catch (e) {
      return this.fail(
        'PROMPT_TEMPLATE_INVALID',
        (e as Error).message,
        prompt.version,
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
    let lastFailureKind: 'validation' | 'truncation' = 'validation';
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    const maxAttempts = this.config.get('LLM_VALIDATION_MAX_ATTEMPTS', {
      infer: true,
    });
    let currentMaxTokens = this.config.get('LLM_MAX_TOKENS', { infer: true });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const userMessage =
        attempt === 1
          ? userText
          : lastFailureKind === 'truncation'
            ? `${userText}\n\nYour previous response was cut off at the token limit. Be concise: keep rationale and flagged fragments brief. Return ONLY valid JSON matching the schema. No prose, no markdown fences.`
            : `${userText}\n\nYour previous response failed validation: ${lastError}.\nReturn ONLY valid JSON matching the schema. No prose, no markdown fences.`;

      let llmResp: LlmCompletionOutput;
      try {
        llmResp = await this.llm.complete({
          system,
          user: userMessage,
          model: prompt.model,
          temperature: 0,
          maxTokens: currentMaxTokens,
        });
      } catch (e) {
        return this.fail(
          'LLM_CALL_FAILED',
          (e as Error).message,
          prompt.version,
          totalTokensIn,
          totalTokensOut,
        );
      }

      totalTokensIn += llmResp.tokensIn;
      totalTokensOut += llmResp.tokensOut;

      if (llmResp.finishReason === 'length') {
        lastFailureKind = 'truncation';
        lastError = `Response truncated at ${currentMaxTokens} tokens`;
        this.logger.warn(
          { checkId: ctx.checkId, attempt, maxTokens: currentMaxTokens },
          'AI response truncated by max_tokens, will retry with doubled limit',
        );
        currentMaxTokens = Math.min(currentMaxTokens * 2, 16384);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(llmResp.content);
      } catch (e) {
        lastFailureKind = 'validation';
        lastError = `JSON.parse failed: ${(e as Error).message}`;
        continue;
      }

      const zodResult = AiAnalysisOutputSchema.safeParse(parsed);
      if (!zodResult.success) {
        lastFailureKind = 'validation';
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
          promptVersion: prompt.version,
          tokensIn: totalTokensIn,
          tokensOut: totalTokensOut,
          attempts: attempt,
        },
      };
    }

    if (lastFailureKind === 'truncation') {
      return this.fail(
        'AI_RESPONSE_TRUNCATED',
        `Response truncated after ${maxAttempts} attempts. Last limit: ${currentMaxTokens / 2} tokens`,
        prompt.version,
        totalTokensIn,
        totalTokensOut,
      );
    }

    return this.fail(
      'AI_VALIDATION_FAILED',
      `Failed schema validation after ${maxAttempts} attempts. Last error: ${lastError}`,
      prompt.version,
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
