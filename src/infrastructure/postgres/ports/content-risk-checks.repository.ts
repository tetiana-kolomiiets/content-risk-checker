import { ContentRiskCheckStatus } from '../../../domain/content-risk-checks/enums/content-risk-check-status.enum';
import { ContentRiskSourceType } from '../../../domain/content-risk-checks/enums/content-risk-source-type.enum';
import { ContentRiskStepName } from '../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { ContentRiskCheck } from '../../../domain/content-risk-checks/types/content-risk-check.type';

export interface ContentRiskChecksRepository {
  create(data: {
    requestId: string;
    sourceType: ContentRiskSourceType;
    rawText: string;
    contentHash: string;
    maxRetries: number;
    replayOfCheckId?: string | null;
  }): Promise<ContentRiskCheck | Error>;

  getById(id: string): Promise<ContentRiskCheck | Error>;

  getMany(status?: ContentRiskCheckStatus): Promise<ContentRiskCheck[] | Error>;

  update(data: {
    id: string;
    status?: ContentRiskCheckStatus;
    currentStep?: ContentRiskStepName | null;
    normalizedText?: string | null;
    errorMessage?: string | null;
    retryCount?: number;
    startedAt?: Date | null;
    finishedAt?: Date | null;
  }): Promise<ContentRiskCheck | Error>;

  findByContentHash(contentHash: string): Promise<ContentRiskCheck | Error>;

  findActiveByContentHash(
    contentHash: string,
  ): Promise<ContentRiskCheck | Error>;
}
