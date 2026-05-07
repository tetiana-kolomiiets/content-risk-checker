import { ApiProperty } from '@nestjs/swagger';
import { ContentRiskCategory } from '../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { FlaggedFragmentDto } from './flagged-fragment.dto';
import { MatchedRuleDto } from './matched-rule.dto';

export class ContentRiskAnalysisResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  checkId: string;

  @ApiProperty({ enum: ContentRiskLevel })
  finalRiskLevel: ContentRiskLevel;

  @ApiProperty({ enum: ContentRiskCategory, isArray: true })
  categories: ContentRiskCategory[];

  @ApiProperty()
  matchedRulesCount: number;

  @ApiProperty()
  totalRulesChecked: number;

  @ApiProperty({ type: () => FlaggedFragmentDto, isArray: true })
  flaggedFragments: FlaggedFragmentDto[];

  @ApiProperty({ type: () => MatchedRuleDto, isArray: true })
  matchedRules: MatchedRuleDto[];

  @ApiProperty({ required: false, nullable: true })
  summary?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
