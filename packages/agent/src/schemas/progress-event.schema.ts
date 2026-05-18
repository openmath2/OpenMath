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

export const ProgressEventSchema = z.discriminatedUnion("type", [
  StepEventSchema,
  RetryEventSchema,
  ResultEventSchema,
  ErrorEventSchema,
]);

export type ProgressEvent = z.infer<typeof ProgressEventSchema>;
