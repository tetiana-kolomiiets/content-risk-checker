import { ContentRiskCategory } from '../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../domain/content-risk-checks/enums/content-risk-level.enum';
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
    flaggedFragments: unknown;
    matchedRules: unknown;
    summary?: string | null;
  }): Promise<ContentRiskAnalysisResult | Error>;

  getByCheckId(
    checkId: string,
  ): Promise<ContentRiskAnalysisResult | null | Error>;

  delete(checkId: string): Promise<void | Error>;
}
