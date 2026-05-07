import { ContentRiskCategory } from '../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { AiFewShotExample } from '../../../domain/content-risk-checks/types/ai-few-shot-example.type';

export const AI_ANALYSIS_MEMORY_REPOSITORY = 'AI_ANALYSIS_MEMORY_REPOSITORY';

export interface FindSimilarOptions {
  topN: number;
  minSimilarity: number;
  excludeCheckId: string;
}

export interface CreateAiAnalysisMemoryInput {
  checkId: string;
  embedding: number[];
  embeddingModel: string;
  contentSnippet: string;
  contentHash: string;
  finalRiskLevel: ContentRiskLevel;
  categories: ContentRiskCategory[];
  rationale: string;
  promptVersionId: string;
}

export interface AiAnalysisMemoryRepository {
  findSimilar(
    embedding: number[],
    promptVersionId: string,
    options: FindSimilarOptions,
  ): Promise<AiFewShotExample[]>;

  create(data: CreateAiAnalysisMemoryInput): Promise<{ id: string } | null>;
}
