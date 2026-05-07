import type { ContentRiskAnalysisResult as PrismaContentRiskAnalysisResult } from '../../../../../generated/prisma/client';
import { ContentRiskCategory } from '../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { FlaggedFragmentSchema } from '../../../../domain/content-risk-checks/schemas/flagged-fragment.schema';
import { MatchedRuleSchema } from '../../../../domain/content-risk-checks/schemas/matched-rule.schema';
import type { ContentRiskAnalysisResult } from '../../../../domain/content-risk-checks/types/content-risk-analysis-result.type';

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
    flaggedFragments: FlaggedFragmentSchema.array().parse(row.flaggedFragments),
    matchedRules: MatchedRuleSchema.array().parse(row.matchedRules),
    summary: row.summary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};
