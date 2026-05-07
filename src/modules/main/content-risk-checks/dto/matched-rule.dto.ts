import { ApiProperty } from '@nestjs/swagger';
import { ContentRiskCategory } from '../../../../domain/content-risk-checks/enums/content-risk-category.enum';

class MatchedRuleFragmentDto {
  @ApiProperty()
  fragment: string;
}

export class MatchedRuleDto {
  @ApiProperty()
  ruleId: string;

  @ApiProperty({ enum: ContentRiskCategory })
  category: ContentRiskCategory;

  @ApiProperty({ type: () => MatchedRuleFragmentDto, isArray: true })
  fragments: MatchedRuleFragmentDto[];
}
