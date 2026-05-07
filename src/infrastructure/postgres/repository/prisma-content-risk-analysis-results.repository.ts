import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client';
import { ContentRiskCategory } from '../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { ContentRiskAnalysisResultsRepository } from '../ports/content-risk-analysis-results.repository';
import { PrismaService } from '../prisma/prisma.service';
import {
  FAILED_TO_CREATE_CONTENT_RISK_ANALYSIS_RESULT,
  FAILED_TO_DELETE_CONTENT_RISK_ANALYSIS_RESULT,
  FAILED_TO_GET_CONTENT_RISK_ANALYSIS_RESULT_BY_CHECK_ID,
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
    flaggedFragments: unknown;
    matchedRules: unknown;
    summary?: string | null;
  }) {
    try {
      const row = await this.prismaService.contentRiskAnalysisResult.create({
        data: {
          checkId: data.checkId,
          finalRiskLevel: data.finalRiskLevel,
          categories: data.categories,
          matchedRulesCount: data.matchedRulesCount,
          totalRulesChecked: data.totalRulesChecked,
          flaggedFragments: data.flaggedFragments as Prisma.InputJsonValue,
          matchedRules: data.matchedRules as Prisma.InputJsonValue,
          summary: data.summary,
        },
      });

      return toDomainContentRiskAnalysisResult(row);
    } catch (err) {
      return new RepositoryError(
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
      return new RepositoryError(
        FAILED_TO_GET_CONTENT_RISK_ANALYSIS_RESULT_BY_CHECK_ID,
        FAILED_TO_GET_CONTENT_RISK_ANALYSIS_RESULT_BY_CHECK_ID,
        err,
      );
    }
  }

  async delete(checkId: string): Promise<void | Error> {
    try {
      await this.prismaService.contentRiskAnalysisResult.deleteMany({
        where: { checkId },
      });
    } catch (err) {
      return new RepositoryError(
        FAILED_TO_DELETE_CONTENT_RISK_ANALYSIS_RESULT,
        FAILED_TO_DELETE_CONTENT_RISK_ANALYSIS_RESULT,
        err,
      );
    }
  }
}
