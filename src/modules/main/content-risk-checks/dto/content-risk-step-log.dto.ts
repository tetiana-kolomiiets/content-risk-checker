import { ApiProperty } from '@nestjs/swagger';
import { ContentRiskStepName } from '../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { StepExecutionStatus } from '../../../../domain/content-risk-checks/enums/step-execution-status.enum';

export class ContentRiskStepLogDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  checkId: string;

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

  @ApiProperty({ format: 'date-time' })
  startedAt: string;

  @ApiProperty({ required: false, nullable: true, format: 'date-time' })
  finishedAt?: string | null;

  @ApiProperty({ required: false, nullable: true })
  durationMs?: number | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}
