import { StepDetails } from '../../../../../domain/content-risk-checks/schemas/step-details.schema';

export type StepResult<O> =
  | { ok: true; output: O; details: StepDetails }
  | {
      ok: false;
      error: { code: string; message: string };
      details: StepDetails;
    };
