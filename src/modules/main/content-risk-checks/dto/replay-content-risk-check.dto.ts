import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReplayContentRiskCheckDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;
}
