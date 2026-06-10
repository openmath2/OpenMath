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
  grade: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),

  /** FE alias from `packages/web/hooks/use-verification-stream.ts`. */
  topic: z.string().optional(),
  topic_code: z.string().optional(),
  topic_name: z.string().optional(),

  /** FE-selected evaluation dimensions. Step 6 treats these as requested keeps. */
  dims: z.array(z.string()).default([]),

  count: z.number().int().min(1).max(20).default(5),
  difficulty: DifficultySchema.default("medium"),
  problem_type: ProblemTypeSchema.default("objective"),

  source_problem_text: z.string().optional(),
}).superRefine((request, ctx) => {
  if (request.school_level === "middle" && request.grade === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Middle school requests require grade",
      path: ["grade"],
    });
  }
  if (request.topic === undefined && request.topic_code === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either topic or topic_code is required",
      path: ["topic"],
    });
  }
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export function getGenerateRequestTopicCode(request: GenerateRequest): string {
  return request.topic_code ?? request.topic ?? "";
}
