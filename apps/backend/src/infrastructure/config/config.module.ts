import { Logger, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EnvConfig, envSchema } from './env.schema';

const logger = new Logger('ConfigModule');

const validateEnv = (raw: Record<string, unknown>): EnvConfig => {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    logger.error('Environment validation failed:');
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      logger.error(`  - ${path}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
};

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
})
export class ConfigModule {}
