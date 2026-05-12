process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '3000';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5434/content_risk_checker_test?schema=public';

process.env.REDIS_HOST = process.env.TEST_REDIS_HOST ?? 'localhost';
process.env.REDIS_PORT = process.env.TEST_REDIS_PORT ?? '6380';

process.env.WORKER_CONCURRENCY = '2';

process.env.OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY ?? 'test-key-placeholder';
process.env.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
process.env.LLM_MODEL = 'anthropic/claude-opus-4-5';
process.env.LLM_TIMEOUT_MS = '5000';

process.env.LOG_LEVEL = 'fatal';
process.env.LOG_PRETTY = 'false';

process.env.THROTTLE_TTL_MS = '1000';
process.env.THROTTLE_LIMIT = '10000';
