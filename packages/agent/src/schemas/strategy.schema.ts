/**
 * Strategy — 성취기준별 출제 전략 YAML.
 *
 * 도메인: `docs/specs/domain.md` §2.5.
 * 불변식 I-T1 ~ I-T4 참조.
 *
 * 사용처:
 * - data/achievement-standards/<code>.yaml 파일 1:1 매핑
 * - Step 2·3에서 generation 변형 룰 제공
 * - [비할당] 데이터 담당이 매일 만지는 토스 단위
 */

import { z } from "zod";

import { EvaluationDimensionSchema } from "./intent.schema.js";
import {
  DifficultySchema,
  ProblemTypeSchema,
  SchoolLevelSchema,
} from "./source-problem.schema.js";

const OBJECTIVE_CODE_PATTERN = /^(9수|10공수)\d{2}-\d{2}$/;

/**
 * 구조 동형 변형 룰 (예시 — 실제 룰셋은 한진우/이동민과 확정 후 확장).
 */
export const StructuralTransformSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("coefficient_swap"),
    range: z.tuple([z.number(), z.number()]),
    exclude_zero: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal("sign_flip"),
  }),
  z.object({
    kind: z.literal("variable_rename"),
    allowed: z.array(z.string()),
  }),
]);

export type StructuralTransform = z.infer<typeof StructuralTransformSchema>;

/**
 * 개념 동형 변형 룰 (예시).
 */
export const ConceptualTransformSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rephrase_as_word_problem"),
    context: z.array(z.string()), // ["속력", "면적", "수열"]
  }),
  z.object({
    kind: z.literal("present_via_root_relations"),
    hint: z.string().optional(),
  }),
  z.object({
    kind: z.literal("inverse_question"),
    hint: z.string().optional(),
  }),
]);

export type ConceptualTransform = z.infer<typeof ConceptualTransformSchema>;

export const StrategySchema = z.object({
  code: z.string().regex(OBJECTIVE_CODE_PATTERN), // I-T1
  title: z.string().min(1),
  school_level: SchoolLevelSchema,
  grade: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),

  techniques: z.object({
    required_at_least_one_of: z.array(z.string()),
    forbidden: z.array(z.string()).default([]),
  }),

  evaluation_dimensions: z.array(EvaluationDimensionSchema).min(1), // I-T2

  difficulty_range: z.array(DifficultySchema).min(1).default(["easy", "medium"]),
  problem_types_supported: z.array(ProblemTypeSchema).min(1),

  structural_transforms: z.array(StructuralTransformSchema).default([]),
  conceptual_transforms: z.array(ConceptualTransformSchema).default([]),
});

export type Strategy = z.infer<typeof StrategySchema>;

/**
 * I-T2 보강 — must_preserve 차원이 ≥ 1개.
 * I-T4 보강 — conceptual_transforms가 비어 있으면 mode=conceptual 불가.
 */
export function assertStrategyInvariants(s: Strategy): void {
  const preserved = s.evaluation_dimensions.filter((d) => d.must_preserve);
  if (preserved.length === 0) {
    throw new Error(`I-T2 violated: strategy ${s.code} needs at least one must_preserve dimension`);
  }
}

export function strategySupportsConceptual(s: Strategy): boolean {
  return s.conceptual_transforms.length > 0;
}
