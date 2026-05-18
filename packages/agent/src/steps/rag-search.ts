/** Step 1: RAG retrieval. Deterministic (D-5). Uses RagClient (D-7). */

import type { GenerateRequest, RagResult } from "../schemas/index.js";
import type { RagClient } from "../tools/rag-client.js";

export interface RagSearchDeps {
  rag: RagClient;
}

export interface RagSearchInput {
  request: GenerateRequest;
}

export interface RagSearchOutput {
  refs: RagResult[];
}

export async function ragSearch(
  _deps: RagSearchDeps,
  _input: RagSearchInput,
): Promise<RagSearchOutput> {
  throw new Error("ragSearch: not implemented yet");
}
