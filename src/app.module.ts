import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TraceContext } from './common/tracing/trace-context';
import { TraceMiddleware } from './common/tracing/trace.middleware';
import { ConfigModule } from './config/config.module';
import type { EnvConfig } from './config/env.schema';
import { EmbeddingModule } from './infrastructure/embedding/embedding.module';
import { LlmModule } from './infrastructure/llm/llm.module';
import { PrismaModule } from './infrastructure/postgres/prisma/prisma.module';
import { AiMemoryModule } from './modules/main/ai-memory/ai-memory.module';
import { ContentRiskChecksModule } from './modules/main/content-risk-checks/content-risk-checks.module';
import { HealthModule } from './modules/main/health/health.module';
import { PromptsModule } from './modules/main/prompts/prompts.module';

const SECRET_KEY_PATTERN = /(key|token|password)/i;

const redactSecretsByName = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactSecretsByName);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY_PATTERN.test(k) ? '[Redacted]' : redactSecretsByName(v);
  }
  return out;
};

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          transport: config.get('LOG_PRETTY', { infer: true })
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
          customProps: () => ({ traceId: TraceContext.get() }),
          formatters: {
            log: (obj) => redactSecretsByName(obj) as Record<string, unknown>,
          },
          redact: {
            paths: [
              'apiKey',
              'api_key',
              'API_KEY',
              'OPENROUTER_API_KEY',
              '*.apiKey',
              '*.api_key',
              '*.password',
              '*.token',
              '*.OPENROUTER_API_KEY',
              'req.headers.authorization',
              'req.headers.cookie',
            ],
            remove: true,
          },
          serializers: {
            req: pino.stdSerializers.req,
            res: pino.stdSerializers.res,
            err: pino.stdSerializers.err,
          },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => [
        {
          ttl: config.get('THROTTLE_TTL_MS', { infer: true }) ?? 60_000,
          limit: config.get('THROTTLE_LIMIT', { infer: true }) ?? 60,
        },
      ],
    }),
    PrismaModule,
    LlmModule,
    EmbeddingModule,
    HealthModule,
    ContentRiskChecksModule,
    PromptsModule,
    AiMemoryModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
