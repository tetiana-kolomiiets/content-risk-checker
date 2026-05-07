import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { ContentRiskCheckStatus } from '../../../../domain/content-risk-checks/enums/content-risk-check-status.enum';

export enum ContentRiskCheckIncludeField {
  RAW_TEXT = 'rawText',
}

const toIncludeArray = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value;
};

export class GetContentRiskCheckDto {
  @ApiProperty({ enum: ContentRiskCheckStatus, required: false })
  @IsOptional()
  @IsEnum(ContentRiskCheckStatus)
  status?: ContentRiskCheckStatus;

  @ApiProperty({
    enum: ContentRiskCheckIncludeField,
    isArray: true,
    required: false,
    description:
      'Fields to include in the response in addition to the defaults (e.g. ?include=rawText)',
  })
  @IsOptional()
  @Transform(({ value }) => toIncludeArray(value))
  @IsArray()
  @IsEnum(ContentRiskCheckIncludeField, { each: true })
  include?: ContentRiskCheckIncludeField[];
}
