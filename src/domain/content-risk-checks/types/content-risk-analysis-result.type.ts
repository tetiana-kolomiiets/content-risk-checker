import { FlaggedFragment } from '../../../shared/schemas/flagged-fragment.schema';
import { MatchedRule } from '../../../shared/schemas/matched-rule.schema';
import { ContentRiskCategory } from '../../../shared/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../shared/enums/content-risk-level.enum';

export type ContentRiskAnalysisResult = {
  id: string;
  checkId: string;
  finalRiskLevel: ContentRiskLevel;
  categories: ContentRiskCategory[];
  matchedRulesCount: number;
  totalRulesChecked: number;
  flaggedFragments: FlaggedFragment[];
  matchedRules: MatchedRule[];
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
};
