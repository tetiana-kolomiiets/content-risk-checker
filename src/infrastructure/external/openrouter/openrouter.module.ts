import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.schema';
import { EMBEDDING_CLIENT } from './embedding-client.port';
import { LLM_CLIENT } from './llm-client.port';
import { OpenRouterClient } from './openrouter.client';
import { OpenRouterEmbeddingClient } from './openrouter-embedding.client';

@Global()
@Module({
  providers: [
    OpenRouterClient,
    { provide: LLM_CLIENT, useExisting: OpenRouterClient },
    {
      provide: EMBEDDING_CLIENT,
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        new OpenRouterEmbeddingClient(
          config.getOrThrow('OPENROUTER_API_KEY'),
          config.getOrThrow('OPENROUTER_BASE_URL'),
          config.getOrThrow('AI_EMBEDDING_MODEL'),
          config.getOrThrow('AI_EMBEDDING_TIMEOUT_MS'),
        ),
      inject: [ConfigService],
    },
  ],
  exports: [LLM_CLIENT, EMBEDDING_CLIENT],
})
export class OpenRouterModule {}
