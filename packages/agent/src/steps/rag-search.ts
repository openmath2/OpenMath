/** Step 1: RAG retrieval. Deterministic (D-5). Uses RagClient (D-7). */

import type { GenerateRequest, RagQuery, RagResult } from "../schemas/index.js";
import type { RagClient } from "../tools/rag-client.js";

export interface RagSearchDeps {
  rag: RagClient;
}

export interface RagSearchInput {
  request: GenerateRequest;
}

export interface RagSearchOutput {
  refs: RagResult[];
  fallback_used: boolean;
}

export async function ragSearch(
  deps: RagSearchDeps,
  input: RagSearchInput,
): Promise<RagSearchOutput> {
  const query = toRagQuery(input.request);
  const refs = await searchWithFallback(deps.rag, query);
  return {
    refs: refs.results,
    fallback_used: refs.fallback_used,
  };
}

async function searchWithFallback(
  rag: RagClient,
  query: RagQuery,
): Promise<{ results: RagResult[]; fallback_used: boolean }> {
  const primary = await rag.search(query);
  if (primary.length > 0) {
    return { results: primary, fallback_used: false };
  }

  for (const fallbackQuery of fallbackQueries(query)) {
    const results = await rag.search(fallbackQuery);
    if (results.length > 0) {
      return { results, fallback_used: true };
    }
  }

  return { results: [], fallback_used: false };
}

function fallbackQueries(query: RagQuery): RagQuery[] {
  return [
    {
      ...query,
      difficulty: undefined,
      problem_type: undefined,
    },
    {
      ...query,
      topic_code: undefined,
      difficulty: undefined,
      problem_type: undefined,
    },
    {
      ...query,
      grade: null,
      topic_code: undefined,
      difficulty: undefined,
      problem_type: undefined,
    },
  ];
}

function toRagQuery(request: GenerateRequest): RagQuery {
  const topicFromAlias = request.topic?.trim();
  const topicCode = request.topic_code?.trim();
  const topicName = request.topic_name?.trim() ?? topicFromAlias;
  const usableTopicCode =
    topicCode !== undefined && looksLikeAchievementCode(topicCode)
      ? topicCode
      : undefined;

  return {
    school_level: request.school_level,
    grade: request.grade,
    ...(usableTopicCode ? { topic_code: usableTopicCode } : {}),
    ...(topicName ? { topic_name: topicName } : {}),
    difficulty: request.difficulty,
    problem_type: request.problem_type,
    k: Math.min(Math.max(request.count * 3, 8), 20),
  };
}

function looksLikeAchievementCode(value: string): boolean {
  return /^\d+[\p{Script=Hangul}A-Za-z]*\d{2}-\d{2}$/u.test(value);
}
