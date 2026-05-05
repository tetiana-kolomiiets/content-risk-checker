import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CONTENT_RISK_ANALYSIS_QUEUE } from '../../queue/queue.module';

export type AnalysisJobPayload = {
  checkId: string;
  traceId: string;
};

@Injectable()
export class AnalysisQueue {
  constructor(
    @InjectQueue(CONTENT_RISK_ANALYSIS_QUEUE)
    private readonly queue: Queue<AnalysisJobPayload>,
  ) {}

  async enqueue(payload: AnalysisJobPayload): Promise<void> {
    await this.queue.add('analyze', payload);
  }
}
