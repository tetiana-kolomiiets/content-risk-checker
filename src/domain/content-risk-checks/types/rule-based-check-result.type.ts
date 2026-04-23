import { ContentRiskCategory } from '../enums/content-risk-category.enum';
import { ContentRiskLevel } from '../enums/content-risk-level.enum';

export type RuleBasedCheckResult = {
  ruleName: string;
  category: ContentRiskCategory;
  level: ContentRiskLevel;
  isMatched: boolean;
  matchedTerms: string[];
  score: number;
};
