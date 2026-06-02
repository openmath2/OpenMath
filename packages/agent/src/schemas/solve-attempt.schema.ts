/** SolveAttempt — D-5 independent re-solver output; advisory trace, never final judge (D-1). */

import { z } from "zod";

export const SolveAttemptSchema = z.object({
  derived_answer: z.string().min(1),
  trace: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
});

export type SolveAttempt = z.infer<typeof SolveAttemptSchema>;
