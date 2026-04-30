import { ContentRiskCheckStatus } from '../enums/content-risk-check-status.enum';
import { ContentRiskSourceType } from '../enums/content-risk-source-type.enum';
import { ContentRiskStepName } from '../enums/content-risk-step-name.enum';

export type ContentRiskCheck = {
  id: string;
  requestId: string;
  traceId: string;
  sourceType: ContentRiskSourceType;
  status: ContentRiskCheckStatus;
  currentStep: ContentRiskStepName | null;
  contentHash: string;
  rawText: string;
  normalizedText: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  replayOfCheckId: string | null;
  promptVersionId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
