import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../infrastructure/config/env.schema';

export const CONTENT_RISK_ANALYSIS_QUEUE = 'content-risk-analysis';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        connection: {
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 86400, count: 1000 },
          removeOnFail: { age: 604800 },
        },
      }),
    }),
    BullModule.registerQueue({ name: CONTENT_RISK_ANALYSIS_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
