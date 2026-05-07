import { ContentRiskStepLog } from '../../../../domain/content-risk-checks/types/content-risk-step-log.type';
import { ContentRiskStepLogDto } from '../dto/content-risk-step-log.dto';

export const contentRiskStepLogToDto = (
  stepLog: ContentRiskStepLog,
): ContentRiskStepLogDto => {
  return {
    id: stepLog.id,
    checkId: stepLog.checkId,
    traceId: stepLog.traceId,
    stepName: stepLog.stepName,
    status: stepLog.status,
    attempt: stepLog.attempt,
    message: stepLog.message,
    errorMessage: stepLog.errorMessage,
    details: stepLog.details,
    startedAt: stepLog.startedAt,
    finishedAt: stepLog.finishedAt,
    durationMs: stepLog.durationMs,
    createdAt: stepLog.createdAt,
  };
};
