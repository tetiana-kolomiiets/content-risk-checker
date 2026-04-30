import { ContentRiskStepName } from '../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';

export class PipelineFailedError extends Error {
  constructor(
    public readonly stepName: ContentRiskStepName,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'PipelineFailedError';
  }
}
