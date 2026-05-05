import OpenAI from 'openai';
import { EmbeddingClient, EmbeddingError } from './embedding-client.port';

const MAX_INPUT_CHARS = 8000;

export class OpenRouterEmbeddingClient implements EmbeddingClient {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    baseUrl: string,
    private readonly model: string,
    timeoutMs: number,
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout: timeoutMs,
      maxRetries: 0,
    });
  }

  async embed(text: string): Promise<number[] | EmbeddingError> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text.slice(0, MAX_INPUT_CHARS),
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        return new EmbeddingError(
          'EMBEDDING_FAILED',
          'Empty embedding response',
        );
      }
      return embedding;
    } catch (err) {
      const e = err as { status?: number; message?: string };
      const code =
        e.status === 401
          ? 'EMBEDDING_AUTH'
          : e.status === 429
            ? 'EMBEDDING_RATE_LIMITED'
            : e.status && e.status >= 500
              ? 'EMBEDDING_UPSTREAM_5XX'
              : 'EMBEDDING_FAILED';
      return new EmbeddingError(code, e.message ?? 'Embedding request failed');
    }
  }
}
