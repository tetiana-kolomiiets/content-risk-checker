import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { ContentRiskCategory } from '../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { AiFewShotExample } from '../../../domain/content-risk-checks/types/ai-few-shot-example.type';
import {
  AiAnalysisMemoryRepository,
  CreateAiAnalysisMemoryInput,
  FindSimilarOptions,
} from '../ports/ai-analysis-memory.repository';
import { PrismaService } from '../prisma/prisma.service';
import {
  AI_MEMORY_DUPLICATE_CHECK_ID,
  FAILED_TO_CREATE_AI_MEMORY,
  FAILED_TO_FIND_SIMILAR_AI_MEMORIES,
} from './repository-error-messages';

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
  ): Promise<AiFewShotExample[] | Error> {
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
    } catch {
      return new Error(FAILED_TO_FIND_SIMILAR_AI_MEMORIES);
    }
  }

  async create(
    data: CreateAiAnalysisMemoryInput,
  ): Promise<{ id: string } | Error> {
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
        return new Error(AI_MEMORY_DUPLICATE_CHECK_ID);
      }
      return { id: rows[0].id };
    } catch {
      return new Error(FAILED_TO_CREATE_AI_MEMORY);
    }
  }
}
