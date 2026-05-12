import { z } from 'zod';
import { ContentRiskCategory } from '../enums/content-risk-category.enum';
import { ContentRiskLevel } from '../enums/content-risk-level.enum';

export const AiAnalysisOutputSchema = z.object({
  finalLevel: z.enum(ContentRiskLevel),
  categories: z.array(z.enum(ContentRiskCategory)),
  score: z.number().min(0).max(1),
  rationale: z.string().min(1).max(500),
  flaggedFragments: z
    .array(
      z.object({
        text: z.string(),
        reason: z.string(),
      }),
    )
    .default([]),
});

export type AiAnalysisOutput = z.infer<typeof AiAnalysisOutputSchema>;
