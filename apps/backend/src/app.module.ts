import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';
import { TraceContext } from './infrastructure/common/tracing/trace-context';
import { TraceMiddleware } from './infrastructure/common/tracing/trace.middleware';
import { ConfigModule } from './infrastructure/config/config.module';
import type { EnvConfig } from './infrastructure/config/env.schema';
import { OpenRouterModule } from './infrastructure/external/openrouter/openrouter.module';
import { PrismaModule } from './infrastructure/postgres/client/prisma.module';
import { ContentRiskChecksModule } from './modules/main/content-risk-checks/content-risk-checks.module';
import { HealthModule } from './modules/main/health/health.module';
import { PromptsModule } from './modules/main/prompts/prompts.module';

export const LOGGER_REDACT_OPTIONS = {
  paths: [
    '*.apiKey',
    '*.api_key',
    '*.password',
    '*.token',
    '*.secret',
    '*.credential',
    '*.authorization',
    '*.bearer',
    'OPENROUTER_API_KEY',
    'DATABASE_URL',
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-api-key"]',
  ],
  censor: '[Redacted]',
};

@Module({})
export class AppModule implements NestModule {
  static forRoot(options: { enableWorker: boolean }): DynamicModule {
    return {
      module: AppModule,
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
              redact: LOGGER_REDACT_OPTIONS,
              serializers: {
                req: pino.stdSerializers.req,
                res: pino.stdSerializers.res,
                err: (
                  err: Error & { cause?: unknown; prismaCode?: string },
                ) => {
                  const base = pino.stdSerializers.err(err) as Record<
                    string,
                    unknown
                  >;
                  if (err.cause !== undefined) {
                    base.cause = pino.stdSerializers.err(err.cause as Error);
                  }
                  if (typeof err.prismaCode === 'string') {
                    base.prismaCode = err.prismaCode;
                  }
                  return base;
                },
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
        OpenRouterModule,
        HealthModule,
        ContentRiskChecksModule.register({
          enableWorker: options.enableWorker,
        }),
        PromptsModule,
      ],
      providers: [
        ...(process.env.NODE_ENV === 'test'
          ? []
          : [{ provide: APP_GUARD, useClass: ThrottlerGuard }]),
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
