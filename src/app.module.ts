import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TraceContext } from './common/tracing/trace-context';
import { TraceMiddleware } from './common/tracing/trace.middleware';
import { ConfigModule } from './config/config.module';
import type { EnvConfig } from './config/env.schema';
import { PrismaModule } from './infrastructure/postgres/prisma/prisma.module';
import { DebugModule } from './modules/main/debug/debug.module';
import { HealthModule } from './modules/main/health/health.module';

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
    PrismaModule,
    HealthModule,
    ...(process.env.NODE_ENV === 'development' ? [DebugModule] : []),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
