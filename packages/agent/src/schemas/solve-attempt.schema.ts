/** SolveAttempt — D-5 independent re-solver output; advisory trace, never final judge (D-1). */

import { z } from "zod";

export const SolveAttemptSchema = z.object({
  derived_answer: z.string().min(1),
  trace: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  /** 재풀이가 도달한 정답의 SymPy 평가식 — 생성기 식과 독립인 두 번째 결정론 대조용. */
  verification_expression: z.string().min(1).optional(),
});

export type SolveAttempt = z.infer<typeof SolveAttemptSchema>;
