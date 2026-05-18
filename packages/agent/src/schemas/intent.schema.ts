/**
 * Intent — 학습 의도 + 평가 차원.
 *
 * 도메인: `docs/specs/domain.md` §2.2.
 * 불변식 I-I1 ~ I-I3 참조.
 *
 * 사용처:
 * - Step 2 `intent-extraction.ts`가 `generateObject({ schema: IntentSchema })`로 추출
 * - GeneratedProblem.inferred_intent 필드의 type
 * - 사용자 UX (`s3-b-intent-conceptual.html`) 의 평가 차원 체크박스
 */

import { z } from "zod";

import { DifficultySchema, ProblemTypeSchema } from "./source-problem.schema.js";

export const EvaluationDimensionSchema = z.object({
  id: z.string().min(1), // "A", "B", "C" ...
  description: z.string().min(1),
  must_preserve: z.boolean(),
});

export type EvaluationDimension = z.infer<typeof EvaluationDimensionSchema>;

export const SurfaceConstraintsSchema = z.object({
  difficulty: DifficultySchema,
  problem_type: ProblemTypeSchema,
  expected_choice_count: z.number().int().min(2).max(10).optional(),
});

export type SurfaceConstraints = z.infer<typeof SurfaceConstraintsSchema>;

/**
 * 성취기준 코드 패턴: [9수XX-YY] 중학교, [10공수XX-YY] 고1 공통수학.
 * I-I3 불변식.
 */
const OBJECTIVE_CODE_PATTERN = /^(9수|10공수)\d{2}-\d{2}$/;

export const IntentSchema = z.object({
  objective_code: z
    .string()
    .regex(OBJECTIVE_CODE_PATTERN, "Invalid 성취기준 code pattern"),
  objective_description: z.string().min(1),

  // I-I1: 최소 1개
  evaluation_dimensions: z.array(EvaluationDimensionSchema).min(1),

  required_techniques: z.array(z.string()),
  forbidden_techniques: z.array(z.string()),

  surface_constraints: SurfaceConstraintsSchema,
});

export type Intent = z.infer<typeof IntentSchema>;

/**
 * 도메인 불변식 I-I2: must_preserve 차원이 ≥ 1개.
 *
 * Zod schema가 잡지 못하는 cross-field 제약은 runtime guard로.
 */
export function assertIntentInvariants(intent: Intent): void {
  const preserved = intent.evaluation_dimensions.filter((d) => d.must_preserve);
  if (preserved.length === 0) {
    throw new Error(
      `I-I2 violated: at least one evaluation_dimension must have must_preserve=true (intent ${intent.objective_code})`,
    );
  }
}
