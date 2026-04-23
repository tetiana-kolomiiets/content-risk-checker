import { ContentRiskCategory } from '../enums/content-risk-category.enum';
import { ContentRiskLevel } from '../enums/content-risk-level.enum';
import { RuleBasedCheckResult } from './rule-based-check-result.type';

export type ContentRiskAnalysisResult = {
  id: string;
  checkId: string;
  finalRiskLevel: ContentRiskLevel;
  categories: ContentRiskCategory[];
  matchedRulesCount: number;
  totalRulesChecked: number;
  flaggedFragments: unknown;
  matchedRules: RuleBasedCheckResult[];
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
};
