import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.url(),
  SHADOW_DATABASE_URL: z.url().optional(),

  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_APP_NAME: z.string().default('content-risk-checker'),
  OPENROUTER_APP_URL: z.string().url().default('http://localhost:3000'),
  LLM_MODEL: z.string().default('anthropic/claude-opus-4-5'),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15000),

  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  LOG_PRETTY: z.stringbool().default(false),

  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(10),
});

export type EnvConfig = z.infer<typeof envSchema>;
