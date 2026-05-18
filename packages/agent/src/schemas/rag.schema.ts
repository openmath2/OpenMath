/**
 * RAG query/result schema.
 *
 * 도메인: `docs/specs/domain.md` §2.1 + `architecture.md` D-7.
 *
 * RagClient 인터페이스 (tools/rag-client.ts)의 입출력 타입.
 * agent는 이 schema로만 데이터에 접근 — 실제 저장소 (JSONL / Postgres / Cube)
 * 와 무관.
 */

import { z } from "zod";

import { IntentSchema } from "./intent.schema.js";
import {
  DifficultySchema,
  ProblemTypeSchema,
  SchoolLevelSchema,
  SourceProblemSchema,
} from "./source-problem.schema.js";

export const RagMatchReasonSchema = z.enum([
  "structural",
  "semantic",
  "hybrid",
]);

export type RagMatchReason = z.infer<typeof RagMatchReasonSchema>;

export const RagQuerySchema = z.object({
  school_level: SchoolLevelSchema,
  grade: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),

  topic_code: z.string().optional(),
  topic_name: z.string().optional(),
  difficulty: DifficultySchema.optional(),
  problem_type: ProblemTypeSchema.optional(),

  intent: IntentSchema.optional(),

  k: z.number().int().min(1).max(50).default(8),
});

export type RagQuery = z.infer<typeof RagQuerySchema>;

export const RagResultSchema = z.object({
  item_id: z.string(),
  similarity: z.number().min(0).max(1).optional(),
  problem: SourceProblemSchema,
  match_reason: RagMatchReasonSchema,
});

export type RagResult = z.infer<typeof RagResultSchema>;
