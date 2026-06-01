/**
 * Progress event — workflow가 emit하는 SSE 이벤트.
 *
 * 사용처:
 * - workflows/verification-workflow.ts가 AsyncGenerator로 yield
 * - server/sse/progress-stream.ts가 EventSource 포맷으로 직렬화
 *
 * D-6 (SSE 프로토콜) 의 wire format.
 *
 * 클라이언트 (HTML preview/s4-verification.html)는 step bar에서
 * `step` event를 받아 단계별 ▌ ink indicator를 갱신.
 */

import { z } from "zod";

import { GeneratedProblemSchema } from "./generated-problem.schema.js";
import { StepNameSchema, VerificationSchema } from "./verification.schema.js";

export const StepStatusSchema = z.enum(["start", "done", "info"]);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const StepEventSchema = z.object({
  type: z.literal("step"),
  step: StepNameSchema,
  status: StepStatusSchema,
  timestamp: z.string(), // ISO 8601
  data: z.unknown().optional(),
});

export type StepEvent = z.infer<typeof StepEventSchema>;

export const RetryEventSchema = z.object({
  type: z.literal("retry"),
  attempt: z.number().int().min(1),
  reason: z.string(),
  timestamp: z.string(),
});

export type RetryEvent = z.infer<typeof RetryEventSchema>;

export const ResultEventSchema = z.object({
  type: z.literal("result"),
  candidates: z.array(
    z.object({
      problem: GeneratedProblemSchema,
      verification: VerificationSchema,
    }),
  ),
  timestamp: z.string(),
});

export type ResultEvent = z.infer<typeof ResultEventSchema>;

export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  stage: StepNameSchema.or(z.literal("orchestrator")),
  code: z.string(),
  message: z.string(),
  recoverable: z.boolean(),
  timestamp: z.string(),
});

export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

/* OM-79: 3/6 generate step 완료 직후 첫 후보의 LaTeX 를 미리보여 주기 위한 이벤트.
 * FE (use-verification-stream.ts: parsePreview) 는 wire payload 의 `latex` 만 읽으므로
 * 본 schema 에는 일관성 위해 timestamp 까지 포함하되 wire-adapter 가 latex 만 직렬화한다.
 */
export const PreviewEventSchema = z.object({
  type: z.literal("preview"),
  latex: z.string().min(1),
  timestamp: z.string(),
});

export type PreviewEvent = z.infer<typeof PreviewEventSchema>;

export const ProgressEventSchema = z.discriminatedUnion("type", [
  StepEventSchema,
  RetryEventSchema,
  ResultEventSchema,
  ErrorEventSchema,
  PreviewEventSchema,
]);

export type ProgressEvent = z.infer<typeof ProgressEventSchema>;
