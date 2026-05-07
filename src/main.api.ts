import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureHttpApp } from './bootstrap/http.bootstrap';
import type { EnvConfig } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(
    AppModule.forRoot({ enableWorker: false }),
    { bufferLogs: true },
  );
  configureHttpApp(app);

  const config = app.get<ConfigService<EnvConfig, true>>(ConfigService);
  const logger = app.get(Logger);

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
  logger.log('API process started (worker disabled)');
}

void bootstrap();
