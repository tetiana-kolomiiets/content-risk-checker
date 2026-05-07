import { Injectable } from '@nestjs/common';
import { isPrismaUniqueConstraintError } from '../../../common/utils/prisma-errors';
import { ContentRiskCheckStatus } from '../../../domain/content-risk-checks/enums/content-risk-check-status.enum';
import { ContentRiskSourceType } from '../../../domain/content-risk-checks/enums/content-risk-source-type.enum';
import { ContentRiskStepName } from '../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { ContentRiskChecksRepository } from '../ports/content-risk-checks.repository';
import { PrismaService } from '../prisma/prisma.service';
import {
  FAILED_TO_CREATE_CONTENT_RISK_CHECK,
  FAILED_TO_FIND_CONTENT_RISK_CHECK_BY_CONTENT_HASH,
  FAILED_TO_GET_CONTENT_RISK_CHECK_BY_ID,
  FAILED_TO_GET_CONTENT_RISK_CHECKS,
  FAILED_TO_UPDATE_CONTENT_RISK_CHECK,
} from './repository-error-messages';
import { RepositoryError } from './repository-error';
import { toDomainContentRiskCheck } from './mappers/to-domain-content-risk-check.mapper';

@Injectable()
export class PrismaContentRiskChecksRepository implements ContentRiskChecksRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: {
    requestId: string;
    traceId: string;
    sourceType: ContentRiskSourceType;
    rawText: string;
    contentHash: string;
    maxRetries: number;
    replayOfCheckId?: string | null;
    promptVersionId?: string | null;
  }) {
    try {
      const row = await this.prismaService.contentRiskCheck.create({
        data: {
          requestId: data.requestId,
          traceId: data.traceId,
          sourceType: data.sourceType,
          rawText: data.rawText,
          contentHash: data.contentHash,
          maxRetries: data.maxRetries,
          replayOfCheckId: data.replayOfCheckId,
          promptVersionId: data.promptVersionId,
        },
      });

      return toDomainContentRiskCheck(row);
    } catch (err) {
      return new RepositoryError(
        FAILED_TO_CREATE_CONTENT_RISK_CHECK,
        FAILED_TO_CREATE_CONTENT_RISK_CHECK,
        err,
      );
    }
  }

  async getById(id: string) {
    try {
      const row = await this.prismaService.contentRiskCheck.findUnique({
        where: { id },
      });

      if (!row) {
        return null;
      }

      return toDomainContentRiskCheck(row);
    } catch (err) {
      return new RepositoryError(
        FAILED_TO_GET_CONTENT_RISK_CHECK_BY_ID,
        FAILED_TO_GET_CONTENT_RISK_CHECK_BY_ID,
        err,
      );
    }
  }

  async getMany(status?: ContentRiskCheckStatus) {
    try {
      const rows = await this.prismaService.contentRiskCheck.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
      });

      return rows.map(toDomainContentRiskCheck);
    } catch (err) {
      return new RepositoryError(
        FAILED_TO_GET_CONTENT_RISK_CHECKS,
        FAILED_TO_GET_CONTENT_RISK_CHECKS,
        err,
      );
    }
  }

  async update(data: {
    id: string;
    status?: ContentRiskCheckStatus;
    currentStep?: ContentRiskStepName | null;
    normalizedText?: string | null;
    errorMessage?: string | null;
    retryCount?: number;
    promptVersionId?: string | null;
    replayOfCheckId?: string | null;
    duplicateOfCheckId?: string | null;
    startedAt?: Date | null;
    finishedAt?: Date | null;
  }) {
    try {
      const row = await this.prismaService.contentRiskCheck.update({
        where: { id: data.id },
        data: {
          status: data.status,
          currentStep: data.currentStep,
          normalizedText: data.normalizedText,
          errorMessage: data.errorMessage,
          retryCount: data.retryCount,
          promptVersionId: data.promptVersionId,
          replayOfCheckId: data.replayOfCheckId,
          duplicateOfCheckId: data.duplicateOfCheckId,
          startedAt: data.startedAt,
          finishedAt: data.finishedAt,
        },
      });

      return toDomainContentRiskCheck(row);
    } catch (err) {
      // Surface unique-constraint violations so the pipeline can run race-fallback.
      if (isPrismaUniqueConstraintError(err)) {
        throw err;
      }
      return new RepositoryError(
        FAILED_TO_UPDATE_CONTENT_RISK_CHECK,
        FAILED_TO_UPDATE_CONTENT_RISK_CHECK,
        err,
      );
    }
  }

  async findByContentHash(
    contentHash: string,
    promptVersionId?: string | null,
  ) {
    try {
      const row = await this.prismaService.contentRiskCheck.findFirst({
        where: {
          contentHash,
          ...(promptVersionId !== undefined ? { promptVersionId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!row) {
        return new RepositoryError(
          FAILED_TO_FIND_CONTENT_RISK_CHECK_BY_CONTENT_HASH,
          FAILED_TO_FIND_CONTENT_RISK_CHECK_BY_CONTENT_HASH,
        );
      }

      return toDomainContentRiskCheck(row);
    } catch (err) {
      return new RepositoryError(
        FAILED_TO_FIND_CONTENT_RISK_CHECK_BY_CONTENT_HASH,
        FAILED_TO_FIND_CONTENT_RISK_CHECK_BY_CONTENT_HASH,
        err,
      );
    }
  }

  async findActiveByContentHash(contentHash: string, promptVersionId: string) {
    try {
      const row = await this.prismaService.contentRiskCheck.findFirst({
        where: {
          contentHash,
          promptVersionId,
          status: ContentRiskCheckStatus.COMPLETED,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!row) {
        return null;
      }

      return toDomainContentRiskCheck(row);
    } catch (err) {
      return new RepositoryError(
        FAILED_TO_FIND_CONTENT_RISK_CHECK_BY_CONTENT_HASH,
        FAILED_TO_FIND_CONTENT_RISK_CHECK_BY_CONTENT_HASH,
        err,
      );
    }
  }
}
