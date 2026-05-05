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

// Known limitations (acceptable for MVP, documented in README):
// - Rate limiting is in-memory (per-process); multi-instance deployments may exceed effective limit
// - Prompt cache is per-process with 60s TTL; activation may take up to 60s to propagate across workers
// - Worker process can be separated (npm run start:worker) but default dev mode runs HTTP+worker in one process
// - LLM gateway is OpenRouter; switching to direct provider requires only swapping LlmClient adapter
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
          redact: {
            paths: [
              '*.apiKey',
              '*.password',
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
