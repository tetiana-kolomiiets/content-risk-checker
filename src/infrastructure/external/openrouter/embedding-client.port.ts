export class EmbeddingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

export interface EmbeddingClient {
  embed(text: string): Promise<number[] | EmbeddingError>;
}

export const EMBEDDING_CLIENT = Symbol('EMBEDDING_CLIENT');
