/**
 * FE wire format for `packages/web/hooks/use-verification-stream.ts`.
 *
 * The agent keeps richer domain events internally (`ProgressEvent`). This schema
 * defines the compact SSE payloads consumed by the current Next.js frontend.
 */

import { z } from "zod";

export const WireStepIndexSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);
export type WireStepIndex = z.infer<typeof WireStepIndexSchema>;

export const WireStepStatusSchema = z.enum([
  "started",
  "completed",
  "failed",
]);
export type WireStepStatus = z.infer<typeof WireStepStatusSchema>;

export const WireStepEventSchema = z.object({
  index: WireStepIndexSchema,
  name: z.string().min(1),
  status: WireStepStatusSchema,
  summary: z.string().nullable().optional(),
});
export type WireStepEvent = z.infer<typeof WireStepEventSchema>;

export const WirePreviewEventSchema = z.object({
  latex: z.string().min(1),
});
export type WirePreviewEvent = z.infer<typeof WirePreviewEventSchema>;

export const WireVerificationStatusSchema = z.enum(["pass", "partial", "fail"]);
export type WireVerificationStatus = z.infer<
  typeof WireVerificationStatusSchema
>;

export const WireOverallVerdictSchema = z.enum([
  "verified",
  "rejected",
  "warning",
]);
export type WireOverallVerdict = z.infer<typeof WireOverallVerdictSchema>;

export const WireGateStepSchema = z.enum([
  "rag",
  "intent",
  "generate",
  "sympy_verify",
  "re_solve",
  "objective_map",
]);
export type WireGateStep = z.infer<typeof WireGateStepSchema>;

export const WireGateStatusSchema = z.enum(["passed", "failed", "skipped", "unverified"]);
export type WireGateStatus = z.infer<typeof WireGateStatusSchema>;

export const WireGateSchema = z.object({
  step: WireGateStepSchema,
  status: WireGateStatusSchema,
  duration_ms: z.number().int().min(0),
  failure_code: z.string().optional(),
  failure_message: z.string().optional(),
});
export type WireGate = z.infer<typeof WireGateSchema>;

export const WireResultProblemSchema = z.object({
  id: z.string().min(1),
  question_latex: z.string().min(1),
  answer_latex: z.string().min(1),
  explanation_latex: z.string().optional(),
  isomorphism: z.enum(["structural", "conceptual"]),
  preserved_dimensions: z.array(z.string()),
  source_refs: z.array(z.string()),
  verification_status: WireVerificationStatusSchema,
  overall: WireOverallVerdictSchema,
  gates: z.array(WireGateSchema),
  attempt_count: z.number().int().min(1),
  generation_model: z.string().min(1),
  refined_by: z.array(z.string()),
});
export type WireResultProblem = z.infer<typeof WireResultProblemSchema>;

export const WireResultEventSchema = z.array(WireResultProblemSchema);
export type WireResultEvent = z.infer<typeof WireResultEventSchema>;

export const WireErrorEventSchema = z.object({
  stage: z.string().min(1),
  message: z.string().min(1),
});
export type WireErrorEvent = z.infer<typeof WireErrorEventSchema>;

export type WireEventName = "step" | "preview" | "result" | "error";

export type WireSseEvent =
  | { event: "step"; data: WireStepEvent }
  | { event: "preview"; data: WirePreviewEvent }
  | { event: "result"; data: WireResultEvent }
  | { event: "error"; data: WireErrorEvent };
