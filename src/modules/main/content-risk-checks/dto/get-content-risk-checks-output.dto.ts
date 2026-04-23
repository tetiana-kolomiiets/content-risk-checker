import { ApiProperty } from '@nestjs/swagger';
import { ContentRiskCheckDto } from './content-risk-check.dto';

export class GetContentRiskChecksOutputDto {
  @ApiProperty({ type: () => ContentRiskCheckDto, isArray: true })
  items: ContentRiskCheckDto[];
}
