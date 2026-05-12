import { ApiProperty } from '@nestjs/swagger';
import { ContentRiskCheckStatus } from '../../../../domain/content-risk-checks/enums/content-risk-check-status.enum';
import { ContentRiskSourceType } from '../../../../domain/content-risk-checks/enums/content-risk-source-type.enum';
import { ContentRiskStepName } from '../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { ContentRiskAnalysisResultDto } from './content-risk-analysis-result.dto';

export class PromptVersionSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  version: number;
}

export class ContentRiskCheckDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  requestId: string;

  @ApiProperty({ enum: ContentRiskSourceType })
  sourceType: ContentRiskSourceType;

  @ApiProperty({ enum: ContentRiskCheckStatus })
  status: ContentRiskCheckStatus;

  @ApiProperty({ enum: ContentRiskStepName, required: false, nullable: true })
  currentStep?: ContentRiskStepName | null;

  @ApiProperty()
  contentHash: string;

  @ApiProperty()
  traceId: string;

  @ApiProperty({ required: false })
  rawText?: string;

  @ApiProperty({ required: false, nullable: true })
  normalizedText?: string | null;

  @ApiProperty({ required: false, nullable: true })
  errorMessage?: string | null;

  @ApiProperty()
  retryCount: number;

  @ApiProperty()
  maxRetries: number;

  @ApiProperty({ required: false, nullable: true })
  replayOfCheckId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  duplicateOfCheckId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  promptVersionId?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: () => PromptVersionSummaryDto,
    description:
      'Resolved prompt version (id, name, version). Null when not yet linked.',
  })
  promptVersion?: PromptVersionSummaryDto | null;

  @ApiProperty({ required: false, nullable: true, format: 'date-time' })
  startedAt?: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'date-time' })
  finishedAt?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty({
    required: false,
    nullable: true,
    type: () => ContentRiskAnalysisResultDto,
  })
  analysisResult?: ContentRiskAnalysisResultDto | null;
}
