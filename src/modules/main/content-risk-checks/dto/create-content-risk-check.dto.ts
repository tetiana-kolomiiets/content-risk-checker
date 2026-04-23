import { ApiProperty } from '@nestjs/swagger';
import { ContentRiskSourceType } from '../../../../domain/content-risk-checks/enums/content-risk-source-type.enum';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateContentRiskCheckDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ enum: ContentRiskSourceType, required: false })
  @IsOptional()
  @IsEnum(ContentRiskSourceType)
  sourceType?: ContentRiskSourceType;
}
