import { ContentRiskStepName } from '../enums/content-risk-step-name.enum';
import { StepExecutionStatus } from '../enums/step-execution-status.enum';

export type ContentRiskStepLog = {
  id: string;
  checkId: string;
  stepName: ContentRiskStepName;
  status: StepExecutionStatus;
  attempt: number;
  message: string | null;
  errorMessage: string | null;
  details: unknown | null;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  createdAt: Date;
};
