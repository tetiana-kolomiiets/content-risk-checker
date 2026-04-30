import { ContentRiskStepName } from '../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { StepContext } from './step-context.type';
import { StepResult } from './step-result.type';

export interface PipelineStep<I, O> {
  readonly name: ContentRiskStepName;
  execute(input: I, ctx: StepContext): Promise<StepResult<O>>;
}
