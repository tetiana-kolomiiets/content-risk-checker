export interface LlmCompletionInput {
  system: string;
  user: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmCompletionOutput {
  content: string;
  tokensIn: number;
  tokensOut: number;
  finishReason: string | null;
}

export interface LlmClient {
  complete(input: LlmCompletionInput): Promise<LlmCompletionOutput>;
}

export const LLM_CLIENT = Symbol('LLM_CLIENT');
