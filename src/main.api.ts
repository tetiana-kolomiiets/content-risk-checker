process.env.DISABLE_WORKER = 'true';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureHttpApp } from './bootstrap/http.bootstrap';
import type { EnvConfig } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureHttpApp(app);

  const config = app.get<ConfigService<EnvConfig, true>>(ConfigService);
  const logger = app.get(Logger);

  await app.listen(config.get('PORT', { infer: true }));
  logger.log('API process started (worker disabled)');
}

void bootstrap();
