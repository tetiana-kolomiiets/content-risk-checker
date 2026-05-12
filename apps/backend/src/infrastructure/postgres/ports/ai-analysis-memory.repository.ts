import { ContentRiskCategory } from '../../../shared/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../shared/enums/content-risk-level.enum';
import { AiFewShotExample } from '../../../shared/schemas/ai-few-shot-example.schema';

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
