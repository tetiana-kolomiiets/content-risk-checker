import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureHttpApp } from './bootstrap/http.bootstrap';
import type { EnvConfig } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureHttpApp(app);
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: false,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Trace-Id'],
    exposedHeaders: ['X-Trace-Id'],
  });

  const config = app.get<ConfigService<EnvConfig, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
