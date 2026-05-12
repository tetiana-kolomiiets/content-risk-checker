import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureHttpApp } from './http.bootstrap';
import type { EnvConfig } from './infrastructure/config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(
    AppModule.forRoot({ enableWorker: true }),
    { bufferLogs: true },
  );
  configureHttpApp(app);

  const config = app.get<ConfigService<EnvConfig, true>>(ConfigService);
  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: false,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Trace-Id'],
    exposedHeaders: ['X-Trace-Id'],
  });

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
