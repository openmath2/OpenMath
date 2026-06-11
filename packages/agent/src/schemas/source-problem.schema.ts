/**
 * SourceProblem — math-sample-unified-v1.
 *
 * 도메인: `docs/specs/domain.md` §2.1.
 * 출처: AI Hub 3종 데이터셋 정규화 (`docs/PROGRESS.md` §2.3).
 *
 * 불변식 (I-S1 ~ I-S5)은 도메인 spec 참조.
 */

import { z } from "zod";

export const SchoolLevelSchema = z.enum(["middle", "high"]);
export type SchoolLevel = z.infer<typeof SchoolLevelSchema>;

export const ProblemTypeSchema = z.enum([
  "objective",
  "essay",
  "short_answer",
  "subjective",
]);
export type ProblemType = z.infer<typeof ProblemTypeSchema>;

export const DifficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const SourceDatasetSchema = z.enum(["110", "111", "30"]);
export type SourceDataset = z.infer<typeof SourceDatasetSchema>;

export const SourceProblemSchema = z.object({
  item_id: z.string().min(1),
  source_dataset: SourceDatasetSchema,
  split: z.enum(["train", "validation"]),
  source_label_type: z.string(),

  school_level: SchoolLevelSchema,
  grade: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  semester: z.union([z.literal(1), z.literal(2)]).nullable(),
  topic_code: z.string().nullable(),
  topic_name: z.string(),
  achievement_standard: z.string().nullable(),

  question_text: z.string().min(1),
  answer_text: z.string().min(1),
  explanation_text: z.string().nullable(),
  choice_blocks: z.array(z.string()).nullable(),

  problem_type_norm: ProblemTypeSchema,
  difficulty_norm: DifficultySchema,

  question_image_relpath: z.string().nullable(),
  answer_image_relpath: z.string().nullable(),
  question_json_relpath: z.string().nullable(),
  answer_json_relpath: z.string().nullable(),
});

export type SourceProblem = z.infer<typeof SourceProblemSchema>;

export function assertSourceProblemInvariants(problem: SourceProblem): void {
  if (problem.question_text.trim().length === 0) {
    throw new Error(`I-S1 violated: source problem ${problem.item_id} needs non-empty question_text`);
  }
  if (problem.achievement_standard === null || problem.achievement_standard.trim().length === 0) {
    throw new Error(`I-S2 violated: source problem ${problem.item_id} needs achievement_standard`);
  }
  if (/\\(?:d?frac|sqrt|cdot|left|right|pi|pm)/u.test(problem.question_text)) {
    throw new Error(`I-S3 violated: source problem ${problem.item_id} question_text must be normalized plain text`);
  }
  if (problem.explanation_text === null || problem.explanation_text.trim().length === 0) {
    throw new Error(`I-S4 violated: source problem ${problem.item_id} needs explanation_text`);
  }
  if (problem.grade === null) {
    throw new Error(`I-S5 violated: source problem ${problem.item_id} needs grade`);
  }
}
