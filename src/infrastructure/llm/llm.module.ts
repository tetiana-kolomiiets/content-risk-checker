import { Global, Module } from '@nestjs/common';
import { LLM_CLIENT } from './llm.types';
import { OpenRouterClient } from './openrouter.client';

@Global()
@Module({
  providers: [
    OpenRouterClient,
    { provide: LLM_CLIENT, useExisting: OpenRouterClient },
  ],
  exports: [LLM_CLIENT],
})
export class LlmModule {}
