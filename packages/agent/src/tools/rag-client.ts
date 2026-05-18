/**
 * RAG client interface (architecture.md D-7).
 *
 * agent는 이 interface로만 데이터 접근.
 * 1차 MVP 구현: JSONL + 메모리 인덱스 (createInMemoryRagClient).
 * 후속 swap 가능: Postgres / Cube / pgvector — Q-2 partial closure.
 */

import type { RagQuery, RagResult } from "../schemas/index.js";

export interface RagClient {
  search(query: RagQuery): Promise<RagResult[]>;
  warmup?(): Promise<void>;
}

export interface InMemoryRagClientOptions {
  jsonlPath: string;
}

export function createInMemoryRagClient(
  _opts: InMemoryRagClientOptions,
): RagClient {
  throw new Error("createInMemoryRagClient: not implemented yet");
}
