import { ApiProperty } from '@nestjs/swagger';
import { ContentRiskCheckStatus } from '../../../../domain/content-risk-checks/enums/content-risk-check-status.enum';
import { IsEnum, IsOptional } from 'class-validator';

export class GetContentRiskCheckDto {
  @ApiProperty({ enum: ContentRiskCheckStatus, required: false })
  @IsOptional()
  @IsEnum(ContentRiskCheckStatus)
  status?: ContentRiskCheckStatus;
}
