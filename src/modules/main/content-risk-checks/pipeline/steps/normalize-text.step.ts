import { Injectable } from '@nestjs/common';
import { ContentRiskStepName } from '../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { PipelineStep } from '../contracts/pipeline-step.interface';
import { StepContext } from '../contracts/step-context.type';
import { StepResult } from '../contracts/step-result.type';

interface NormalizeInput {
  rawText: string;
}

interface NormalizeOutput {
  normalizedText: string;
}

const CONTROL_CHARS_RE = /[\x00-\x1F\x7F]/g;

@Injectable()
export class NormalizeTextStep implements PipelineStep<
  NormalizeInput,
  NormalizeOutput
> {
  readonly name = ContentRiskStepName.NORMALIZE_TEXT;

  execute(
    input: NormalizeInput,
    _ctx: StepContext,
  ): Promise<StepResult<NormalizeOutput>> {
    const cleaned = input.rawText
      .replace(/\s+/g, ' ')
      .replace(CONTROL_CHARS_RE, '')
      .trim()
      .toLowerCase();

    const charsRemoved = input.rawText.length - cleaned.length;

    return Promise.resolve({
      ok: true,
      output: { normalizedText: cleaned },
      details: {
        stepName: ContentRiskStepName.NORMALIZE_TEXT,
        charsRemoved,
        lowercased: true,
      },
    });
  }
}
