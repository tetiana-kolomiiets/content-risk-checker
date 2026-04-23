import { ContentRiskAnalysisResult } from '../../../../domain/content-risk-checks/types/content-risk-analysis-result.type';
import { ContentRiskAnalysisResultDto } from '../dto/content-risk-analysis-result.dto';

export const contentRiskAnalysisResultToDto = (
  analysisResult: ContentRiskAnalysisResult,
): ContentRiskAnalysisResultDto => {
  return {
    id: analysisResult.id,
    checkId: analysisResult.checkId,
    finalRiskLevel: analysisResult.finalRiskLevel,
    categories: analysisResult.categories,
    matchedRulesCount: analysisResult.matchedRulesCount,
    totalRulesChecked: analysisResult.totalRulesChecked,
    flaggedFragments: analysisResult.flaggedFragments,
    matchedRules: analysisResult.matchedRules,
    summary: analysisResult.summary,
    createdAt: analysisResult.createdAt,
    updatedAt: analysisResult.updatedAt,
  };
};
