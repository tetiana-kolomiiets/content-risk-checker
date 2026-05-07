import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ContentRiskSourceType } from '../../../../domain/content-risk-checks/enums/content-risk-source-type.enum';

export class CreateContentRiskCheckDto {
  @ApiProperty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1)
  @MaxLength(10000)
  text: string;

  @ApiProperty({ enum: ContentRiskSourceType, required: false })
  @IsOptional()
  @IsEnum(ContentRiskSourceType)
  sourceType?: ContentRiskSourceType;
}
