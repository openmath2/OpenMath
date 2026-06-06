/** Step 1: RAG retrieval. Deterministic (D-5). Uses RagClient (D-7). */

import {
  getGenerateRequestTopicCode,
  type GenerateRequest,
  type RagResult,
} from "../schemas/index.js";
import { withTimeout } from "../policies/timeout-policy.js";
import type { RagClient } from "../tools/rag-client.js";

export interface RagSearchDeps {
  rag: RagClient;
  perStepTimeoutMs?: number;
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
  return withTimeout(async () => {
    const request = input.request;
    const baseQuery = {
      school_level: request.school_level,
      grade: request.grade,
      topic_code: getGenerateRequestTopicCode(request),
      topic_name: request.topic_name,
      source_problem_text: request.source_problem_text,
      k: Math.max(request.count, 8),
    };
    const refs = await searchAligned(deps.rag, {
      ...baseQuery,
      difficulty: request.difficulty,
      problem_type: request.problem_type,
    });
    if (refs.length > 0) return { refs };

    const relaxedFormatRefs = await searchAligned(deps.rag, baseQuery);
    if (relaxedFormatRefs.length > 0) return { refs: relaxedFormatRefs };

    const relaxedTopicQuery = { ...baseQuery, topic_code: undefined };
    const relaxedRefs = await searchAligned(deps.rag, {
      ...relaxedTopicQuery,
      difficulty: request.difficulty,
      problem_type: request.problem_type,
    });
    if (relaxedRefs.length > 0) return { refs: relaxedRefs };

    const broadRefs = await searchAligned(deps.rag, relaxedTopicQuery);
    if (broadRefs.length > 0) return { refs: broadRefs };

    for (const topicName of topicNameAliases(baseQuery.topic_code)) {
      const aliasRefs = await searchAligned(deps.rag, {
        ...relaxedTopicQuery,
        topic_name: topicName,
      });
      if (aliasRefs.length > 0) return { refs: aliasRefs };
    }

    return { refs: [] };
  }, { ms: deps.perStepTimeoutMs ?? 30_000, label: "rag" });
}

async function searchAligned(
  rag: RagClient,
  query: Parameters<RagClient["search"]>[0],
): Promise<RagResult[]> {
  const refs = await rag.search(query);
  return refs.filter((ref) => topicAligned(ref, query.topic_name));
}

function topicAligned(ref: RagResult, topicName: string | undefined): boolean {
  if (topicName === undefined) return true;
  const queryTokens = tokenize(topicName);
  if (queryTokens.length <= 1) return tokenOverlapCount(queryTokens, topicEvidence(ref)) >= 1;
  const overlap = tokenOverlapCount(queryTokens, topicEvidence(ref));
  return overlap >= 2 || overlap / queryTokens.length >= 0.4;
}

function topicEvidence(ref: RagResult): string {
  return [
    ref.problem.topic_name,
    ref.problem.achievement_standard,
    ref.problem.question_text,
    ref.problem.answer_text,
    ref.problem.explanation_text,
  ].filter(Boolean).join("\n");
}

function tokenOverlapCount(queryTokens: string[], target: string): number {
  const targetTokens = tokenize(target);
  return queryTokens.filter((token) =>
    targetTokens.some((targetToken) => tokensMatch(token, targetToken)),
  ).length;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^0-9a-zA-Z가-힣]+/u).filter((token) => token.length > 0);
}

function tokensMatch(queryToken: string, targetToken: string): boolean {
  return queryToken === targetToken || targetToken.includes(queryToken);
}

function topicNameAliases(topicCode: string | undefined): string[] {
  if (topicCode === "9수04-06") return ["원의 접선 성질"];
  return [];
}
