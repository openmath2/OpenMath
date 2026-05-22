/**
 * RAG client interface (architecture.md D-7).
 *
 * agent는 이 interface로만 데이터 접근.
 * 1차 MVP 구현: JSONL + 메모리 인덱스 (createInMemoryRagClient).
 * 후속 swap 가능: Postgres / Cube / pgvector — Q-2 partial closure.
 */

import { readFile } from "node:fs/promises";

import {
  RagQuerySchema,
  SourceProblemSchema,
  type RagQuery,
  type RagResult,
  type SourceProblem,
} from "../schemas/index.js";

export interface RagClient {
  search(query: RagQuery): Promise<RagResult[]>;
  warmup?(): Promise<void>;
}

export interface InMemoryRagClientOptions {
  jsonlPath: string;
}

export function createInMemoryRagClient(
  opts: InMemoryRagClientOptions,
): RagClient {
  let corpus: SourceProblem[] | null = null;

  async function loadCorpus(): Promise<SourceProblem[]> {
    if (corpus !== null) return corpus;
    const contents = await readFile(opts.jsonlPath, "utf8");
    corpus = contents
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line, index) => {
        const value: unknown = JSON.parse(line);
        const parsed = SourceProblemSchema.safeParse(value);
        if (!parsed.success) {
          throw new Error(
            `Invalid SourceProblem at ${opts.jsonlPath}:${index + 1}: ${parsed.error.message}`,
          );
        }
        return parsed.data;
      });
    return corpus;
  }

  return {
    async warmup() {
      await loadCorpus();
    },
    async search(query) {
      const parsed = RagQuerySchema.parse(query);
      const rows = await loadCorpus();
      return rows
        .filter((problem) => matchesQuery(problem, parsed))
        .map((problem) => toResult(problem, parsed))
        .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
        .slice(0, parsed.k);
    },
  };
}

function matchesQuery(problem: SourceProblem, query: RagQuery): boolean {
  if (problem.school_level !== query.school_level) return false;
  if (query.grade !== null && problem.grade !== query.grade) return false;
  if (query.topic_code !== undefined && problem.topic_code !== query.topic_code) {
    return false;
  }
  if (
    query.topic_name !== undefined &&
    !problem.topic_name.includes(query.topic_name) &&
    !query.topic_name.includes(problem.topic_name)
  ) {
    return false;
  }
  if (query.difficulty !== undefined && problem.difficulty_norm !== query.difficulty) {
    return false;
  }
  if (query.problem_type !== undefined && problem.problem_type_norm !== query.problem_type) {
    return false;
  }
  return true;
}

function toResult(problem: SourceProblem, query: RagQuery): RagResult {
  let score = 0.4;
  const sourceMatch = sourceProblemMatches(problem, query.source_problem_text);
  if (query.topic_code !== undefined && problem.topic_code === query.topic_code) {
    score += 0.3;
  }
  if (query.grade !== null && problem.grade === query.grade) score += 0.1;
  if (query.difficulty !== undefined && problem.difficulty_norm === query.difficulty) {
    score += 0.1;
  }
  if (query.problem_type !== undefined && problem.problem_type_norm === query.problem_type) {
    score += 0.1;
  }
  if (sourceMatch) score += 0.4;
  return {
    item_id: problem.item_id,
    similarity: Math.min(score, 1),
    problem,
    match_reason: sourceMatch ? "hybrid" : "structural",
  };
}

function sourceProblemMatches(
  problem: SourceProblem,
  sourceProblemText: string | undefined,
): boolean {
  if (sourceProblemText === undefined) return false;
  const source = normalizeMathText(sourceProblemText);
  const question = normalizeMathText(problem.question_text);
  if (source.length === 0 || question.length === 0) return false;
  return source.includes(question) || question.includes(source);
}

function normalizeMathText(value: string): string {
  return value
    .replace(/²/g, "**2")
    .replace(/\s+/g, "")
    .toLowerCase();
}
