import { ContentRiskCheckStatus } from '../../../shared/enums/content-risk-check-status.enum';
import { ContentRiskSourceType } from '../../../shared/enums/content-risk-source-type.enum';
import { ContentRiskStepName } from '../../../shared/enums/content-risk-step-name.enum';
import { ContentRiskCheck } from '../../../domain/content-risk-checks/types/content-risk-check.type';

export const CONTENT_RISK_CHECKS_REPOSITORY = 'CONTENT_RISK_CHECKS_REPOSITORY';

export interface ContentRiskChecksRepository {
  create(data: {
    requestId: string;
    traceId: string;
    sourceType: ContentRiskSourceType;
    rawText: string;
    contentHash: string;
    maxRetries: number;
    replayOfCheckId?: string | null;
    promptVersionId?: string | null;
  }): Promise<ContentRiskCheck>;

  getById(id: string): Promise<ContentRiskCheck | null>;

  getMany(status?: ContentRiskCheckStatus): Promise<ContentRiskCheck[]>;

  update(data: {
    id: string;
    status?: ContentRiskCheckStatus;
    currentStep?: ContentRiskStepName | null;
    normalizedText?: string | null;
    errorMessage?: string | null;
    retryCount?: number;
    promptVersionId?: string | null;
    replayOfCheckId?: string | null;
    duplicateOfCheckId?: string | null;
    startedAt?: Date | null;
    finishedAt?: Date | null;
  }): Promise<ContentRiskCheck>;

  findActiveByContentHash(
    contentHash: string,
    promptVersionId: string,
  ): Promise<ContentRiskCheck | null>;
}
