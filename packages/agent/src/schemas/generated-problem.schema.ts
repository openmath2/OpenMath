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

  question_text: z.string().min(1), // LaTeX
  expected_answer: z.string().min(1), // LaTeX
  expected_choices: z.array(z.string()).optional(), // objective일 때
  proposed_solution_trace: z.string(),

  source_refs: z.array(z.string()), // SourceProblem.item_id[]
  inferred_intent: IntentSchema,

  generation_metadata: GenerationMetaSchema,
});

export type GeneratedProblem = z.infer<typeof GeneratedProblemSchema>;
