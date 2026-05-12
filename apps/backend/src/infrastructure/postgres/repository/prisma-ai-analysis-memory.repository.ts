import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { ContentRiskCategory } from '../../../shared/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../shared/enums/content-risk-level.enum';
import { AiFewShotExample } from '../../../shared/schemas/ai-few-shot-example.schema';
import {
  AiAnalysisMemoryRepository,
  CreateAiAnalysisMemoryInput,
  FindSimilarOptions,
} from '../ports/ai-analysis-memory.repository';
import { PrismaService } from '../client/prisma.service';
import {
  FAILED_TO_CREATE_AI_MEMORY,
  FAILED_TO_FIND_SIMILAR_AI_MEMORIES,
} from './repository-error-messages';
import { RepositoryError } from './repository-error';

interface SimilarRow {
  contentSnippet: string;
  finalRiskLevel: ContentRiskLevel;
  categories: ContentRiskCategory[];
  rationale: string;
  similarity: number;
}

const toVectorLiteral = (embedding: number[]): string =>
  `[${embedding.join(',')}]`;

@Injectable()
export class PrismaAiAnalysisMemoryRepository implements AiAnalysisMemoryRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findSimilar(
    embedding: number[],
    promptVersionId: string,
    options: FindSimilarOptions,
  ): Promise<AiFewShotExample[]> {
    try {
      const vectorLiteral = toVectorLiteral(embedding);
      const rows = await this.prismaService.$queryRaw<SimilarRow[]>(
        Prisma.sql`
          SELECT
            "contentSnippet",
            "finalRiskLevel",
            "categories",
            "rationale",
            1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
          FROM "AiAnalysisMemory"
          WHERE "promptVersionId" = ${promptVersionId}
            AND "checkId" <> ${options.excludeCheckId}
          ORDER BY embedding <=> ${vectorLiteral}::vector
          LIMIT ${options.topN}
        `,
      );

      return rows
        .filter((r) => r.similarity >= options.minSimilarity)
        .map((r) => ({
          contentSnippet: r.contentSnippet,
          finalRiskLevel: r.finalRiskLevel,
          categories: r.categories,
          rationale: r.rationale,
          similarity: r.similarity,
        }));
    } catch (err) {
      throw new RepositoryError(
        FAILED_TO_FIND_SIMILAR_AI_MEMORIES,
        FAILED_TO_FIND_SIMILAR_AI_MEMORIES,
        err,
      );
    }
  }

  async create(
    data: CreateAiAnalysisMemoryInput,
  ): Promise<{ id: string } | null> {
    try {
      const vectorLiteral = toVectorLiteral(data.embedding);
      const categoriesArray = `{${data.categories.join(',')}}`;
      const rows = await this.prismaService.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          INSERT INTO "AiAnalysisMemory" (
            "id",
            "checkId",
            "embedding",
            "embeddingModel",
            "contentSnippet",
            "contentHash",
            "finalRiskLevel",
            "categories",
            "rationale",
            "promptVersionId",
            "createdAt"
          )
          VALUES (
            gen_random_uuid(),
            ${data.checkId},
            ${vectorLiteral}::vector,
            ${data.embeddingModel},
            ${data.contentSnippet},
            ${data.contentHash},
            ${data.finalRiskLevel}::"ContentRiskLevel",
            ${categoriesArray}::"ContentRiskCategory"[],
            ${data.rationale},
            ${data.promptVersionId},
            NOW()
          )
          ON CONFLICT ("checkId") DO NOTHING
          RETURNING "id"
        `,
      );

      if (rows.length === 0) {
        return null;
      }
      return { id: rows[0].id };
    } catch (err) {
      throw new RepositoryError(
        FAILED_TO_CREATE_AI_MEMORY,
        FAILED_TO_CREATE_AI_MEMORY,
        err,
      );
    }
  }
}
