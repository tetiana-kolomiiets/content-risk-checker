import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client';
import { ContentRiskStepName } from '../../../shared/enums/content-risk-step-name.enum';
import { StepExecutionStatus } from '../../../shared/enums/step-execution-status.enum';
import { ContentRiskStepLogsRepository } from '../ports/content-risk-step-logs.repository';
import { PrismaService } from '../client/prisma.service';
import {
  FAILED_TO_CREATE_CONTENT_RISK_STEP_LOG,
  FAILED_TO_GET_CONTENT_RISK_STEP_LOGS_BY_CHECK_ID,
  FAILED_TO_UPDATE_CONTENT_RISK_STEP_LOG,
} from './repository-error-messages';
import { RepositoryError } from './repository-error';
import { toDomainContentRiskStepLog } from './mappers/to-domain-content-risk-step-log.mapper';

@Injectable()
export class PrismaContentRiskStepLogsRepository implements ContentRiskStepLogsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: {
    checkId: string;
    traceId: string;
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
          traceId: data.traceId,
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
    } catch (err) {
      throw new RepositoryError(
        FAILED_TO_CREATE_CONTENT_RISK_STEP_LOG,
        FAILED_TO_CREATE_CONTENT_RISK_STEP_LOG,
        err,
      );
    }
  }

  async update(
    id: string,
    data: {
      status?: StepExecutionStatus;
      message?: string | null;
      errorMessage?: string | null;
      details?: unknown;
      finishedAt?: Date | null;
      durationMs?: number | null;
    },
  ) {
    try {
      const row = await this.prismaService.contentRiskStepLog.update({
        where: { id },
        data: {
          status: data.status,
          message: data.message,
          errorMessage: data.errorMessage,
          details: data.details as Prisma.InputJsonValue | undefined,
          finishedAt: data.finishedAt,
          durationMs: data.durationMs,
        },
      });

      return toDomainContentRiskStepLog(row);
    } catch (err) {
      throw new RepositoryError(
        FAILED_TO_UPDATE_CONTENT_RISK_STEP_LOG,
        FAILED_TO_UPDATE_CONTENT_RISK_STEP_LOG,
        err,
      );
    }
  }

  async getByCheckId(checkId: string) {
    try {
      const rows = await this.prismaService.contentRiskStepLog.findMany({
        where: { checkId },
        orderBy: { createdAt: 'asc' },
      });

      return rows.map(toDomainContentRiskStepLog);
    } catch (err) {
      throw new RepositoryError(
        FAILED_TO_GET_CONTENT_RISK_STEP_LOGS_BY_CHECK_ID,
        FAILED_TO_GET_CONTENT_RISK_STEP_LOGS_BY_CHECK_ID,
        err,
      );
    }
  }
}
