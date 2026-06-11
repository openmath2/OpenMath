/**
 * GeneratedProblem — 생성된 후보 문제.
 *
 * 도메인: `docs/specs/domain.md` §2.3.
 * 불변식 I-G1 ~ I-G4 참조.
 *
 * 사용처:
 * - Step 3 `problem-generation.ts`의 출력
 * - Step 4·5·6의 입력
 * - Verification.candidate_id가 이걸 참조
 */

import { z } from "zod";

import { GenerationKindSchema } from "./generation-kind.schema.js";
import { IntentSchema } from "./intent.schema.js";

export const IsomorphicModeSchema = z.enum(["structural", "conceptual"]);
export type IsomorphicMode = z.infer<typeof IsomorphicModeSchema>;

export const GenerationMetaSchema = z.object({
  model: z.string(), // e.g., "gpt-4o", "claude-sonnet-4.5"
  temperature: z.number().min(0).max(2),
  prompt_id: z.string(), // e.g., "problem-generator"
  prompt_version: z.string(), // e.g., "0.3.0"
  attempt: z.number().int().min(0),
  generated_at: z.string(), // ISO 8601
  refined_by: z.array(z.string()).optional(), // ["constraint-critic", "refiner"]
});

export type GenerationMeta = z.infer<typeof GenerationMetaSchema>;

export const GeneratedProblemSchema = z.object({
  candidate_id: z.string().uuid(),
  mode: IsomorphicModeSchema,
  generation_kind: GenerationKindSchema,

  question_text: z.string().min(1), // LaTeX
  expected_answer: z.string().min(1), // LaTeX
  expected_choices: z.array(z.string()).optional(), // objective일 때
  techniques_used: z.array(z.string()).default([]),
  proposed_solution_trace: z.string(),
  /** 정답에 도달하는 SymPy 식. sympy_verify가 expected_answer와 결정론적으로 대조한다.
   *  - 숫자 답(경우의 수 등): 평가식 (예: "factorial(3)*factorial(3)*factorial(4)") →
   *    /evaluate로 수치 평가 후 대조.
   *  - 식 답(전개·간단히 등): 정답과 독립인 *미전개 원식*
   *    (예: "x**3 + 5*x*(x+1) - (x+4)*(x-1)*(x+2)") → simplify+verify로 기호 동치 대조.
   *  equation이 아닌 kind도 이 식으로 결정론 검증이 가능해진다. */
  verification_expression: z.string().min(1).optional(),

  source_refs: z.array(z.string()), // SourceProblem.item_id[]
  inferred_intent: IntentSchema,

  generation_metadata: GenerationMetaSchema,
});

export type GeneratedProblem = z.infer<typeof GeneratedProblemSchema>;

export function assertGeneratedProblemInvariants(
  problem: GeneratedProblem,
  intent: z.infer<typeof IntentSchema>,
): void {
  if (problem.inferred_intent.objective_code !== intent.objective_code) {
    throw new Error(
      `I-G1 violated: generated problem ${problem.candidate_id} inferred objective ${problem.inferred_intent.objective_code} does not match intent ${intent.objective_code}`,
    );
  }
  if (!sameNormalizedSet(problem.inferred_intent.required_techniques, intent.required_techniques)) {
    throw new Error(`I-G2 violated: generated problem ${problem.candidate_id} changed required_techniques`);
  }
  if (problem.mode === "conceptual" && !preservesMustPreserveDimensions(problem, intent)) {
    throw new Error(`I-G3 violated: conceptual generated problem ${problem.candidate_id} changed must_preserve dimensions`);
  }
}

function preservesMustPreserveDimensions(
  problem: GeneratedProblem,
  intent: z.infer<typeof IntentSchema>,
): boolean {
  const candidateDimensions = new Set(
    problem.inferred_intent.evaluation_dimensions
      .filter((dimension) => dimension.must_preserve)
      .map((dimension) => normalizedDimensionKey(dimension.id, dimension.description)),
  );
  return intent.evaluation_dimensions
    .filter((dimension) => dimension.must_preserve)
    .every((dimension) => candidateDimensions.has(normalizedDimensionKey(dimension.id, dimension.description)));
}

function sameNormalizedSet(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = normalizedSet(left);
  const normalizedRight = normalizedSet(right);
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function normalizedSet(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizeToken).filter((value) => value.length > 0))].sort();
}

function normalizedDimensionKey(id: string, description: string): string {
  return `${normalizeToken(id)}:${normalizeToken(description)}`;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}
