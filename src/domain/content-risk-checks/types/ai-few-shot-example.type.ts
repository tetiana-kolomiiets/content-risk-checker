import { ContentRiskCategory } from '../enums/content-risk-category.enum';
import { ContentRiskLevel } from '../enums/content-risk-level.enum';

export interface AiFewShotExample {
  contentSnippet: string;
  finalRiskLevel: ContentRiskLevel;
  categories: ContentRiskCategory[];
  rationale: string;
  similarity: number;
}
