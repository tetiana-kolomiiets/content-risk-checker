import { Inject, OnModuleInit } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { TraceContext } from '../../../infrastructure/common/tracing/trace-context';
import { ContentRiskCheckStatus } from '../../../shared/enums/content-risk-check-status.enum';
import { ContentRiskStepName } from '../../../shared/enums/content-risk-step-name.enum';
import { StepExecutionStatus } from '../../../shared/enums/step-execution-status.enum';
import {
  CONTENT_RISK_CHECKS_REPOSITORY,
  ContentRiskChecksRepository,
} from '../../../infrastructure/postgres/ports/content-risk-checks.repository';
import {
  CONTENT_RISK_STEP_LOGS_REPOSITORY,
  ContentRiskStepLogsRepository,
} from '../../../infrastructure/postgres/ports/content-risk-step-logs.repository';
import type { EnvConfig } from '../../../infrastructure/config/env.schema';
import { CONTENT_RISK_ANALYSIS_QUEUE } from '../../queue/queue.module';
import { AnalysisJobPayload } from './analysis.queue';
import { ContentRiskChecksPipelineService } from './content-risk-checks-pipeline.service';

@Processor(CONTENT_RISK_ANALYSIS_QUEUE)
export class ContentRiskChecksProcessor
  extends WorkerHost
  implements OnModuleInit
{
  constructor(
    private readonly pipeline: ContentRiskChecksPipelineService,
    @Inject(CONTENT_RISK_CHECKS_REPOSITORY)
    private readonly checksRepo: ContentRiskChecksRepository,
    @Inject(CONTENT_RISK_STEP_LOGS_REPOSITORY)
    private readonly stepLogsRepo: ContentRiskStepLogsRepository,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext('AnalysisProcessor');
  }

  onModuleInit(): void {
    this.worker.concurrency = this.config.get('WORKER_CONCURRENCY', {
      infer: true,
    });
  }

  async process(job: Job<AnalysisJobPayload>): Promise<void> {
    return TraceContext.run(job.data.traceId, async () => {
      await this.checksRepo.update({
        id: job.data.checkId,
        retryCount: job.attemptsMade + 1,
      });
      if (job.attemptsMade > 0) {
        this.logger.warn(
          { attempt: job.attemptsMade + 1, checkId: job.data.checkId },
          'Retrying check analysis',
        );
      }
      await this.pipeline.run(job.data.checkId, job.data.traceId);
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AnalysisJobPayload>, error: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    return TraceContext.run(job.data.traceId, async () => {
      const check = await this.checksRepo.getById(job.data.checkId);
      const failedStep =
        check?.currentStep ?? ContentRiskStepName.AGGREGATE_RESULT;

      await this.checksRepo.update({
        id: job.data.checkId,
        status: ContentRiskCheckStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: error.message,
      });

      const now = new Date();
      await this.stepLogsRepo.create({
        checkId: job.data.checkId,
        traceId: job.data.traceId,
        stepName: failedStep,
        status: StepExecutionStatus.FAILED,
        attempt: job.attemptsMade,
        errorMessage: `Pipeline exhausted retries: ${error.message}`,
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
      });

      this.logger.error(
        {
          checkId: job.data.checkId,
          attempts: job.attemptsMade,
          err: error,
          code: 'RETRIES_EXHAUSTED',
          failedStep,
        },
        'Pipeline exhausted retries, check marked FAILED',
      );
    });
  }
}
