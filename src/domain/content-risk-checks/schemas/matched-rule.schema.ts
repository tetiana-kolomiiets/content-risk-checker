import { z } from 'zod';
import { ContentRiskCategory } from '../enums/content-risk-category.enum';

export const MatchedRuleSchema = z.object({
  ruleId: z.string().min(1).max(100),
  category: z.enum(ContentRiskCategory),
  fragments: z.array(z.object({ fragment: z.string().min(1).max(500) })),
});

export type MatchedRule = z.infer<typeof MatchedRuleSchema>;
