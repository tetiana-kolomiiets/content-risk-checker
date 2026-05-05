import { z } from 'zod';
import { ContentRiskCategory } from '../enums/content-risk-category.enum';
import { ContentRiskLevel } from '../enums/content-risk-level.enum';

export const AiFewShotExampleSchema = z.object({
  contentSnippet: z.string().max(200),
  finalRiskLevel: z.enum(ContentRiskLevel),
  categories: z.array(z.enum(ContentRiskCategory)),
  rationale: z.string().max(500),
  similarity: z.number().min(0).max(1),
});

export type AiFewShotExample = z.infer<typeof AiFewShotExampleSchema>;
