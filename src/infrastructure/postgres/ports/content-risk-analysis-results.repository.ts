import { ContentRiskCategory } from '../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { FlaggedFragment } from '../../../domain/content-risk-checks/schemas/flagged-fragment.schema';
import { MatchedRule } from '../../../domain/content-risk-checks/schemas/matched-rule.schema';
import { ContentRiskAnalysisResult } from '../../../domain/content-risk-checks/types/content-risk-analysis-result.type';

export const CONTENT_RISK_ANALYSIS_RESULTS_REPOSITORY =
  'CONTENT_RISK_ANALYSIS_RESULTS_REPOSITORY';

export interface ContentRiskAnalysisResultsRepository {
  create(data: {
    checkId: string;
    finalRiskLevel: ContentRiskLevel;
    categories: ContentRiskCategory[];
    matchedRulesCount: number;
    totalRulesChecked: number;
    flaggedFragments: FlaggedFragment[];
    matchedRules: MatchedRule[];
    summary?: string | null;
  }): Promise<ContentRiskAnalysisResult>;

  getByCheckId(checkId: string): Promise<ContentRiskAnalysisResult | null>;

  delete(checkId: string): Promise<void>;
}
