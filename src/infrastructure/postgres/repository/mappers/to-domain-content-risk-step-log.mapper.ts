import type { ContentRiskStepLog as PrismaContentRiskStepLog } from '../../../../../generated/prisma/client';
import { ContentRiskStepName } from '../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { StepExecutionStatus } from '../../../../domain/content-risk-checks/enums/step-execution-status.enum';
import type { ContentRiskStepLog } from '../../../../domain/content-risk-checks/types/content-risk-step-log.type';

export const toDomainContentRiskStepLog = (
  row: PrismaContentRiskStepLog,
): ContentRiskStepLog => {
  return {
    id: row.id,
    checkId: row.checkId,
    stepName: row.stepName as ContentRiskStepName,
    status: row.status as StepExecutionStatus,
    attempt: row.attempt,
    message: row.message,
    errorMessage: row.errorMessage,
    details: row.details ?? null,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs,
    createdAt: row.createdAt,
  };
};
