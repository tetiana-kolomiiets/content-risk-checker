import OpenAI from 'openai';
import { EmbeddingError } from '../embedding-client.port';
import { OpenRouterEmbeddingClient } from '../openrouter-embedding.client';

jest.mock('openai');

interface MockEmbeddings {
  create: jest.Mock;
}

const buildEmbedding = (length: number): number[] =>
  Array.from({ length }, (_, i) => i / length);

describe('OpenRouterEmbeddingClient', () => {
  let createMock: jest.Mock;

  beforeEach(() => {
    createMock = jest.fn();
    const MockedOpenAI = OpenAI as unknown as jest.Mock;
    MockedOpenAI.mockImplementation(() => ({
      embeddings: { create: createMock } satisfies MockEmbeddings,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns a 1536-dim embedding on success', async () => {
    const embedding = buildEmbedding(1536);
    createMock.mockResolvedValueOnce({ data: [{ embedding }] });

    const client = new OpenRouterEmbeddingClient(
      'sk-test',
      'https://openrouter.ai/api/v1',
      'openai/text-embedding-3-small',
      10000,
    );

    const result = await client.embed('hello');

    expect(Array.isArray(result)).toBe(true);
    if (result instanceof EmbeddingError) return;
    expect(result.length).toBe(1536);
    expect(createMock).toHaveBeenCalledWith({
      model: 'openai/text-embedding-3-small',
      input: 'hello',
    });
  });

  it('truncates input above 8000 chars', async () => {
    createMock.mockResolvedValueOnce({
      data: [{ embedding: buildEmbedding(4) }],
    });
    const client = new OpenRouterEmbeddingClient('k', 'u', 'm', 1000);

    const long = 'a'.repeat(9000);
    await client.embed(long);

    const firstCall = createMock.mock.calls[0] as Array<{ input: string }>;
    const passed = firstCall[0];
    expect(passed.input.length).toBe(8000);
  });

  it('maps 401 to EMBEDDING_AUTH', async () => {
    createMock.mockRejectedValueOnce({ status: 401, message: 'unauthorized' });
    const client = new OpenRouterEmbeddingClient('k', 'u', 'm', 1000);

    const result = await client.embed('x');

    expect(result).toBeInstanceOf(EmbeddingError);
    if (!(result instanceof EmbeddingError)) return;
    expect(result.code).toBe('EMBEDDING_AUTH');
  });

  it('maps 429 to EMBEDDING_RATE_LIMITED', async () => {
    createMock.mockRejectedValueOnce({ status: 429, message: 'rate limited' });
    const client = new OpenRouterEmbeddingClient('k', 'u', 'm', 1000);

    const result = await client.embed('x');

    expect(result).toBeInstanceOf(EmbeddingError);
    if (!(result instanceof EmbeddingError)) return;
    expect(result.code).toBe('EMBEDDING_RATE_LIMITED');
  });

  it('maps 5xx to EMBEDDING_UPSTREAM_5XX', async () => {
    createMock.mockRejectedValueOnce({ status: 503, message: 'upstream' });
    const client = new OpenRouterEmbeddingClient('k', 'u', 'm', 1000);

    const result = await client.embed('x');

    expect(result).toBeInstanceOf(EmbeddingError);
    if (!(result instanceof EmbeddingError)) return;
    expect(result.code).toBe('EMBEDDING_UPSTREAM_5XX');
  });

  it('falls back to EMBEDDING_FAILED on unknown errors', async () => {
    createMock.mockRejectedValueOnce(new Error('boom'));
    const client = new OpenRouterEmbeddingClient('k', 'u', 'm', 1000);

    const result = await client.embed('x');

    expect(result).toBeInstanceOf(EmbeddingError);
    if (!(result instanceof EmbeddingError)) return;
    expect(result.code).toBe('EMBEDDING_FAILED');
  });
});
