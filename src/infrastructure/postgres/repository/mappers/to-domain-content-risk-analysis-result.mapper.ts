import type { ContentRiskAnalysisResult as PrismaContentRiskAnalysisResult } from '../../../../../generated/prisma/client';
import { ContentRiskCategory } from '../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import type { ContentRiskAnalysisResult } from '../../../../domain/content-risk-checks/types/content-risk-analysis-result.type';
import type { RuleBasedCheckResult } from '../../../../domain/content-risk-checks/types/rule-based-check-result.type';

export const toDomainContentRiskAnalysisResult = (
  row: PrismaContentRiskAnalysisResult,
): ContentRiskAnalysisResult => {
  return {
    id: row.id,
    checkId: row.checkId,
    finalRiskLevel: row.finalRiskLevel as ContentRiskLevel,
    categories: row.categories as ContentRiskCategory[],
    matchedRulesCount: row.matchedRulesCount,
    totalRulesChecked: row.totalRulesChecked,
    flaggedFragments: row.flaggedFragments,
    matchedRules: row.matchedRules as RuleBasedCheckResult[],
    summary: row.summary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};
