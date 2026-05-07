import { z } from 'zod';

export const FlaggedFragmentSchema = z.object({
  text: z.string().min(1).max(500),
  reason: z.string().min(1).max(200),
});

export type FlaggedFragment = z.infer<typeof FlaggedFragmentSchema>;
