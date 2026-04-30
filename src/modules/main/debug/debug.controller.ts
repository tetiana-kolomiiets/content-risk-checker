// TODO: remove this controller after Prompt 10 — used only to verify the
// global response envelope and AllExceptionsFilter wiring.
import {
  Controller,
  Get,
  NotFoundException,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContentRiskStepName } from '../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { PipelineFailedError } from '../content-risk-checks/pipeline/contracts';

@ApiTags('debug')
@Controller({ path: 'debug', version: '1' })
export class DebugController {
  @Post('echo')
  echo(): { ok: true; message: string } {
    return { ok: true, message: 'envelope check' };
  }

  @Get('not-found')
  notFound(): never {
    throw new NotFoundException('resource missing');
  }

  @Get('boom')
  boom(): never {
    throw new Error('boom');
  }

  @Get('pipeline')
  pipeline(): never {
    throw new PipelineFailedError(
      ContentRiskStepName.RUN_AI_ANALYSIS,
      'AI_TIMEOUT',
      'pipeline step timed out',
    );
  }

  @Get('unavailable')
  unavailable(): never {
    throw new ServiceUnavailableException({
      code: 'REDIS_DOWN',
      message: 'redis unreachable',
    });
  }
}
