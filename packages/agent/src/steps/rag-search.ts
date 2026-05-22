/** Step 1: RAG retrieval. Deterministic (D-5). Uses RagClient (D-7). */

import {
  getGenerateRequestTopicCode,
  type GenerateRequest,
  type RagResult,
} from "../schemas/index.js";
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
  deps: RagSearchDeps,
  input: RagSearchInput,
): Promise<RagSearchOutput> {
  const request = input.request;
  const baseQuery = {
    school_level: request.school_level,
    grade: request.grade,
    topic_code: getGenerateRequestTopicCode(request),
    topic_name: request.topic_name,
    source_problem_text: request.source_problem_text,
    k: Math.max(request.count, 8),
  };
  const refs = await deps.rag.search({
    ...baseQuery,
    difficulty: request.difficulty,
    problem_type: request.problem_type,
  });
  if (refs.length > 0) return { refs };

  return { refs: await deps.rag.search(baseQuery) };
}
