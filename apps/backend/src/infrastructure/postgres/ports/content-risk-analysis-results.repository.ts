import { ContentRiskCategory } from '../../../shared/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../shared/enums/content-risk-level.enum';
import { FlaggedFragment } from '../../../shared/schemas/flagged-fragment.schema';
import { MatchedRule } from '../../../shared/schemas/matched-rule.schema';
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

  upsertByCheckId(data: {
    checkId: string;
    finalRiskLevel: ContentRiskLevel;
    categories: ContentRiskCategory[];
    matchedRulesCount: number;
    totalRulesChecked: number;
    flaggedFragments: FlaggedFragment[];
    matchedRules: MatchedRule[];
    summary?: string | null;
  }): Promise<ContentRiskAnalysisResult>;

  delete(checkId: string): Promise<void>;
}
