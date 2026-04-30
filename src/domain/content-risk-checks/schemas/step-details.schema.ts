import { z } from 'zod';
import { ContentRiskLevel } from '../enums/content-risk-level.enum';
import { ContentRiskStepName } from '../enums/content-risk-step-name.enum';

export const StepDetailsSchema = z.discriminatedUnion('stepName', [
  z.object({
    stepName: z.literal(ContentRiskStepName.NORMALIZE_TEXT),
    charsRemoved: z.number().int().min(0),
    lowercased: z.boolean(),
  }),
  z.object({
    stepName: z.literal(ContentRiskStepName.DETECT_DUPLICATE),
    duplicateOfCheckId: z.string().uuid().nullable(),
  }),
  z.object({
    stepName: z.literal(ContentRiskStepName.RUN_RULE_BASED_CHECKS),
    matchedRulesCount: z.number().int().min(0),
    totalRulesChecked: z.number().int().min(0),
    flags: z.array(z.string()),
    score: z.number().min(0).max(1),
  }),
  z.object({
    stepName: z.literal(ContentRiskStepName.RUN_AI_ANALYSIS),
    promptVersion: z.number().int().positive(),
    tokensIn: z.number().int().min(0),
    tokensOut: z.number().int().min(0),
  }),
  z.object({
    stepName: z.literal(ContentRiskStepName.AGGREGATE_RESULT),
    ruleScore: z.number().min(0).max(1),
    aiScore: z.number().min(0).max(1),
    finalScore: z.number().min(0).max(1),
    finalLevel: z.enum(ContentRiskLevel),
  }),
]);

export type StepDetails = z.infer<typeof StepDetailsSchema>;
