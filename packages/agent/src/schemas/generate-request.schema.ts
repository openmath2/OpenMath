/**
 * GenerateRequest — POST /api/generate 의 body.
 *
 * D-6: SSE 응답을 시작하기 위한 진입점.
 *
 * 사용처:
 * - server/routes/generate.ts 의 @hono/zod-validator
 * - workflows/verification-workflow.ts 의 입력
 */

import { z } from "zod";

import {
  DifficultySchema,
  ProblemTypeSchema,
  SchoolLevelSchema,
} from "./source-problem.schema.js";

export const GenerateModeSchema = z.enum(["structural", "conceptual", "auto"]);

export type GenerateMode = z.infer<typeof GenerateModeSchema>;

export const GenerateRequestSchema = z.object({
  mode: GenerateModeSchema.default("auto"),

  school_level: SchoolLevelSchema.default("middle"),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  topic_code: z.string().optional(),
  topic_name: z.string().optional(),

  count: z.number().int().min(1).max(20).default(5),
  difficulty: DifficultySchema.default("medium"),
  problem_type: ProblemTypeSchema.default("objective"),

  /* OM-85 후속: 사용자가 S3-B (intent) 화면에서 선택한 평가 차원 ID 들.
   * Intent 추출 단계에서 'must_preserve=true' 후보를 좁히는 hint 로 사용.
   * full EvaluationDimension 객체 ({id, description, must_preserve}) 는 BE 가
   * Intent 추출 시 생성하므로, FE 는 ID 만 보내고 객체 형성은 BE 책임.
   */
  evaluation_dimension_ids: z.array(z.string()).optional(),

  source_problem_text: z.string().optional(),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
