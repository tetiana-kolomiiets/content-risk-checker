import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import OpenAI from 'openai';
import { EnvConfig } from '../../config/env.schema';
import {
  LlmClient,
  LlmCompletionInput,
  LlmCompletionOutput,
} from './llm.types';

@Injectable()
export class OpenRouterClient implements LlmClient {
  private readonly sdk: OpenAI;
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService<EnvConfig, true>,
    @InjectPinoLogger(OpenRouterClient.name)
    private readonly logger: PinoLogger,
  ) {
    const apiKey = config.get('OPENROUTER_API_KEY', { infer: true });
    const baseURL = config.get('OPENROUTER_BASE_URL', { infer: true });
    const appName =
      config.get('OPENROUTER_APP_NAME', { infer: true }) ??
      'content-risk-checker';
    const appUrl =
      config.get('OPENROUTER_APP_URL', { infer: true }) ??
      'http://localhost:3000';

    this.timeoutMs = config.get('LLM_TIMEOUT_MS', { infer: true }) ?? 15000;

    this.sdk = new OpenAI({
      apiKey,
      baseURL,
      timeout: this.timeoutMs,
      maxRetries: 0,
      defaultHeaders: {
        'HTTP-Referer': appUrl,
        'X-Title': appName,
      },
    });
  }

  async complete(input: LlmCompletionInput): Promise<LlmCompletionOutput> {
    const jitter = Math.floor(Math.random() * 500);
    if (jitter > 0) await new Promise((r) => setTimeout(r, jitter));

    const startMs = Date.now();
    try {
      const response = await this.sdk.chat.completions.create({
        model: input.model,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
        max_tokens: input.maxTokens ?? 1024,
        temperature: input.temperature ?? 0,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new Error('No content in response');
      }

      const tokensIn = response.usage?.prompt_tokens ?? 0;
      const tokensOut = response.usage?.completion_tokens ?? 0;

      this.logger.debug(
        {
          durationMs: Date.now() - startMs,
          model: input.model,
          tokensIn,
          tokensOut,
        },
        'LLM call complete',
      );

      return {
        content: choice.message.content,
        tokensIn,
        tokensOut,
        finishReason: choice.finish_reason ?? null,
      };
    } catch (err) {
      const e = err as { status?: number; message: string };

      if (e.status === 401) throw new Error('OpenRouter: invalid API key');
      if (e.status === 402) throw new Error('OpenRouter: insufficient credits');
      if (e.status === 429) throw new Error('OpenRouter: rate limited');
      if (e.status && e.status >= 500) {
        throw new Error(`OpenRouter: upstream error ${e.status}`);
      }
      if (e.message?.includes('timeout') || e.message?.includes('aborted')) {
        throw new Error(`OpenRouter: timeout after ${this.timeoutMs}ms`);
      }
      throw new Error(`OpenRouter: ${e.message}`);
    }
  }
}
