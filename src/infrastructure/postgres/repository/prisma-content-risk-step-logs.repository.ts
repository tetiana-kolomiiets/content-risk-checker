import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client';
import { ContentRiskStepName } from '../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { StepExecutionStatus } from '../../../domain/content-risk-checks/enums/step-execution-status.enum';
import { ContentRiskStepLogsRepository } from '../ports/content-risk-step-logs.repository';
import { PrismaService } from '../prisma/prisma.service';
import {
  FAILED_TO_CREATE_CONTENT_RISK_STEP_LOG,
  FAILED_TO_GET_CONTENT_RISK_STEP_LOGS_BY_CHECK_ID,
} from './repository-error-messages';
import { toDomainContentRiskStepLog } from './mappers/to-domain-content-risk-step-log.mapper';

@Injectable()
export class PrismaContentRiskStepLogsRepository implements ContentRiskStepLogsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: {
    checkId: string;
    stepName: ContentRiskStepName;
    status: StepExecutionStatus;
    attempt?: number;
    message?: string | null;
    errorMessage?: string | null;
    details?: unknown;
    startedAt?: Date;
    finishedAt?: Date | null;
    durationMs?: number | null;
  }) {
    try {
      const row = await this.prismaService.contentRiskStepLog.create({
        data: {
          checkId: data.checkId,
          stepName: data.stepName,
          status: data.status,
          attempt: data.attempt,
          message: data.message,
          errorMessage: data.errorMessage,
          details: data.details as Prisma.InputJsonValue | undefined,
          startedAt: data.startedAt,
          finishedAt: data.finishedAt,
          durationMs: data.durationMs,
        },
      });

      return toDomainContentRiskStepLog(row);
    } catch {
      return new Error(FAILED_TO_CREATE_CONTENT_RISK_STEP_LOG);
    }
  }

  async getByCheckId(checkId: string) {
    try {
      const rows = await this.prismaService.contentRiskStepLog.findMany({
        where: { checkId },
        orderBy: { createdAt: 'asc' },
      });

      return rows.map(toDomainContentRiskStepLog);
    } catch {
      return new Error(FAILED_TO_GET_CONTENT_RISK_STEP_LOGS_BY_CHECK_ID);
    }
  }
}
