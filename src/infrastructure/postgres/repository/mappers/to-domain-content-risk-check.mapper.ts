import type { ContentRiskCheck as PrismaContentRiskCheck } from '../../../../../generated/prisma/client';
import { ContentRiskCheckStatus } from '../../../../domain/content-risk-checks/enums/content-risk-check-status.enum';
import { ContentRiskSourceType } from '../../../../domain/content-risk-checks/enums/content-risk-source-type.enum';
import { ContentRiskStepName } from '../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import type { ContentRiskCheck } from '../../../../domain/content-risk-checks/types/content-risk-check.type';

export const toDomainContentRiskCheck = (
  row: PrismaContentRiskCheck,
): ContentRiskCheck => {
  return {
    id: row.id,
    requestId: row.requestId,
    traceId: row.traceId,
    sourceType: row.sourceType as ContentRiskSourceType,
    status: row.status as ContentRiskCheckStatus,
    currentStep: (row.currentStep as ContentRiskStepName | null) ?? null,
    contentHash: row.contentHash,
    rawText: row.rawText,
    normalizedText: row.normalizedText ?? null,
    errorMessage: row.errorMessage ?? null,
    retryCount: row.retryCount,
    maxRetries: row.maxRetries,
    replayOfCheckId: row.replayOfCheckId ?? null,
    promptVersionId: row.promptVersionId ?? null,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};
