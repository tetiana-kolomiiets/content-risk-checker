import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client';
import { ContentRiskCategory } from '../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../domain/content-risk-checks/enums/content-risk-level.enum';
import {
  FlaggedFragment,
  FlaggedFragmentSchema,
} from '../../../domain/content-risk-checks/schemas/flagged-fragment.schema';
import {
  MatchedRule,
  MatchedRuleSchema,
} from '../../../domain/content-risk-checks/schemas/matched-rule.schema';
import { ContentRiskAnalysisResultsRepository } from '../ports/content-risk-analysis-results.repository';
import { PrismaService } from '../prisma/prisma.service';
import {
  FAILED_TO_CREATE_CONTENT_RISK_ANALYSIS_RESULT,
  FAILED_TO_DELETE_CONTENT_RISK_ANALYSIS_RESULT,
  FAILED_TO_GET_CONTENT_RISK_ANALYSIS_RESULT_BY_CHECK_ID,
  FAILED_TO_UPSERT_CONTENT_RISK_ANALYSIS_RESULT,
} from './repository-error-messages';
import { RepositoryError } from './repository-error';
import { toDomainContentRiskAnalysisResult } from './mappers/to-domain-content-risk-analysis-result.mapper';

@Injectable()
export class PrismaContentRiskAnalysisResultsRepository implements ContentRiskAnalysisResultsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: {
    checkId: string;
    finalRiskLevel: ContentRiskLevel;
    categories: ContentRiskCategory[];
    matchedRulesCount: number;
    totalRulesChecked: number;
    flaggedFragments: FlaggedFragment[];
    matchedRules: MatchedRule[];
    summary?: string | null;
  }) {
    const flaggedFragments = FlaggedFragmentSchema.array().parse(
      data.flaggedFragments,
    );
    const matchedRules = MatchedRuleSchema.array().parse(data.matchedRules);

    try {
      const row = await this.prismaService.contentRiskAnalysisResult.create({
        data: {
          checkId: data.checkId,
          finalRiskLevel: data.finalRiskLevel,
          categories: data.categories,
          matchedRulesCount: data.matchedRulesCount,
          totalRulesChecked: data.totalRulesChecked,
          flaggedFragments: flaggedFragments,
          matchedRules: matchedRules,
          summary: data.summary,
        },
      });

      return toDomainContentRiskAnalysisResult(row);
    } catch (err) {
      throw new RepositoryError(
        FAILED_TO_CREATE_CONTENT_RISK_ANALYSIS_RESULT,
        FAILED_TO_CREATE_CONTENT_RISK_ANALYSIS_RESULT,
        err,
      );
    }
  }

  async getByCheckId(checkId: string) {
    try {
      const row = await this.prismaService.contentRiskAnalysisResult.findUnique(
        {
          where: { checkId },
        },
      );

      if (!row) {
        return null;
      }

      return toDomainContentRiskAnalysisResult(row);
    } catch (err) {
      throw new RepositoryError(
        FAILED_TO_GET_CONTENT_RISK_ANALYSIS_RESULT_BY_CHECK_ID,
        FAILED_TO_GET_CONTENT_RISK_ANALYSIS_RESULT_BY_CHECK_ID,
        err,
      );
    }
  }

  async upsertByCheckId(data: {
    checkId: string;
    finalRiskLevel: ContentRiskLevel;
    categories: ContentRiskCategory[];
    matchedRulesCount: number;
    totalRulesChecked: number;
    flaggedFragments: FlaggedFragment[];
    matchedRules: MatchedRule[];
    summary?: string | null;
  }) {
    const flaggedFragments = FlaggedFragmentSchema.array().parse(
      data.flaggedFragments,
    );
    const matchedRules = MatchedRuleSchema.array().parse(data.matchedRules);

    const payload = {
      checkId: data.checkId,
      finalRiskLevel: data.finalRiskLevel,
      categories: data.categories,
      matchedRulesCount: data.matchedRulesCount,
      totalRulesChecked: data.totalRulesChecked,
      flaggedFragments: flaggedFragments as Prisma.InputJsonValue,
      matchedRules: matchedRules as Prisma.InputJsonValue,
      summary: data.summary,
    };

    try {
      const row = await this.prismaService.contentRiskAnalysisResult.upsert({
        where: { checkId: data.checkId },
        create: payload,
        update: payload,
      });

      return toDomainContentRiskAnalysisResult(row);
    } catch (err) {
      throw new RepositoryError(
        FAILED_TO_UPSERT_CONTENT_RISK_ANALYSIS_RESULT,
        FAILED_TO_UPSERT_CONTENT_RISK_ANALYSIS_RESULT,
        err,
      );
    }
  }

  async delete(checkId: string): Promise<void> {
    try {
      await this.prismaService.contentRiskAnalysisResult.deleteMany({
        where: { checkId },
      });
    } catch (err) {
      throw new RepositoryError(
        FAILED_TO_DELETE_CONTENT_RISK_ANALYSIS_RESULT,
        FAILED_TO_DELETE_CONTENT_RISK_ANALYSIS_RESULT,
        err,
      );
    }
  }
}
