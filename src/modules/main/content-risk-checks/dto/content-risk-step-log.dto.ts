import { ApiProperty } from '@nestjs/swagger';
import { ContentRiskStepName } from '../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { StepExecutionStatus } from '../../../../domain/content-risk-checks/enums/step-execution-status.enum';

export class ContentRiskStepLogDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  checkId: string;

  @ApiProperty()
  traceId: string;

  @ApiProperty({ enum: ContentRiskStepName })
  stepName: ContentRiskStepName;

  @ApiProperty({ enum: StepExecutionStatus })
  status: StepExecutionStatus;

  @ApiProperty()
  attempt: number;

  @ApiProperty({ required: false, nullable: true })
  message?: string | null;

  @ApiProperty({ required: false, nullable: true })
  errorMessage?: string | null;

  @ApiProperty({ required: false, type: Object })
  details?: unknown;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty({ required: false, nullable: true })
  finishedAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  durationMs?: number | null;

  @ApiProperty()
  createdAt: Date;
}
