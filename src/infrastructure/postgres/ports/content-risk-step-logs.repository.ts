import { ContentRiskStepName } from '../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { StepExecutionStatus } from '../../../domain/content-risk-checks/enums/step-execution-status.enum';
import { ContentRiskStepLog } from '../../../domain/content-risk-checks/types/content-risk-step-log.type';

export const CONTENT_RISK_STEP_LOGS_REPOSITORY =
  'CONTENT_RISK_STEP_LOGS_REPOSITORY';

export interface ContentRiskStepLogsRepository {
  create(data: {
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
  }): Promise<ContentRiskStepLog | Error>;

  update(
    id: string,
    data: {
      status?: StepExecutionStatus;
      message?: string | null;
      errorMessage?: string | null;
      details?: unknown;
      finishedAt?: Date | null;
      durationMs?: number | null;
    },
  ): Promise<ContentRiskStepLog | Error>;

  getByCheckId(checkId: string): Promise<ContentRiskStepLog[] | Error>;
}
