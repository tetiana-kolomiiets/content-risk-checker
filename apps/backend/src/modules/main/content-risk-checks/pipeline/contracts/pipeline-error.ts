import { ContentRiskStepName } from '../../../../../shared/enums/content-risk-step-name.enum';

export class PipelineFailedError extends Error {
  readonly cause?: unknown;

  constructor(
    public readonly stepName: ContentRiskStepName,
    public readonly errorCode: string,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'PipelineFailedError';
    this.cause = cause;
  }
}
