/**
 * RAG client interface (architecture.md D-7).
 *
 * agent는 이 interface로만 데이터 접근.
 * 1차 MVP 구현: JSONL + 메모리 인덱스 (createInMemoryRagClient).
 * 후속 swap 가능: Postgres / Cube / pgvector — Q-2 partial closure.
 */

import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

import type { RagQuery, RagResult, SourceProblem } from "../schemas/index.js";

export interface RagClient {
  search(query: RagQuery): Promise<RagResult[]>;
  warmup?(): Promise<void>;
}

export interface InMemoryRagClientOptions {
  jsonlPath: string;
  minAchievementConfidence?: number;
}

type OpenMathRagRecord = {
  id: {
    problem_id: string;
    source_dataset: "110" | "111" | "30";
    split: "train" | "validation";
    item_id?: string;
    source_label_type?: string;
  };
  curriculum: {
    school_level: "middle" | "high";
    grade: 1 | 2 | 3 | null;
    semester?: 1 | 2 | null;
    topic_code?: string | null;
    topic_name: string;
    achievement_standard?: string | null;
    achievement_confidence?: number;
  };
  problem: {
    question_text: string;
    choice_blocks?: string[] | null;
    answer_text: string;
    explanation_text?: string | null;
    problem_type: "objective" | "essay" | "short_answer" | "subjective";
    difficulty: "easy" | "medium" | "hard";
  };
  taxonomy?: {
    primary_type_id?: string;
    type_ids?: string[];
    primary_subtype_id?: string;
    subtype_ids?: string[];
  };
  rag?: {
    retrieval_text?: string;
    embedding_text?: string;
  };
  media?: {
    question_image_relpath?: string | null;
    answer_image_relpath?: string | null;
  };
  quality?: {
    is_usable?: boolean;
  };
  source_trace?: {
    original_question_json_relpath?: string | null;
    original_answer_json_relpath?: string | null;
  };
};

type IndexedProblem = {
  problem: SourceProblem;
  retrievalText: string;
  embeddingText: string;
  achievementConfidence: number;
  primaryTypeId?: string;
  primarySubtypeId?: string;
  typeIds: string[];
  subtypeIds: string[];
};

export function createInMemoryRagClient(opts: InMemoryRagClientOptions): RagClient {
  const jsonlPath = resolve(opts.jsonlPath);
  const minAchievementConfidence = opts.minAchievementConfidence ?? 0;
  let loadPromise: Promise<IndexedProblem[]> | undefined;
  let index: IndexedProblem[] | undefined;

  async function warmup(): Promise<void> {
    index = await loadCorpusOnce();
  }

  async function search(query: RagQuery): Promise<RagResult[]> {
    const rows = index ?? (await loadCorpusOnce());
    const scored = rows
      .filter((row) => matchesQuery(row, query, minAchievementConfidence))
      .map((row) => {
        const sourceMatch = sourceProblemMatches(row.problem, query.source_problem_text);
        return { row, score: scoreProblem(row, query, sourceMatch), sourceMatch };
      })
      .sort((a, b) => b.score - a.score || a.row.problem.item_id.localeCompare(b.row.problem.item_id));

    return scored.slice(0, query.k ?? 8).map(({ row, score, sourceMatch }) => ({
      item_id: row.problem.item_id,
      similarity: roundSimilarity(score),
      problem: row.problem,
      match_reason: sourceMatch
        ? "hybrid"
        : score >= 0.7
          ? "hybrid"
          : score >= 0.35
            ? "semantic"
            : "structural",
    }));
  }

  async function loadCorpusOnce(): Promise<IndexedProblem[]> {
    loadPromise ??= loadOpenMathJsonl(jsonlPath);
    return loadPromise;
  }

  return { search, warmup };
}

async function loadOpenMathJsonl(jsonlPath: string): Promise<IndexedProblem[]> {
  const rows: IndexedProblem[] = [];
  const lineReader = createInterface({
    input: createReadStream(jsonlPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  for await (const line of lineReader) {
    lineNumber += 1;
    if (!line.trim()) {
      continue;
    }

    let record: OpenMathRagRecord;
    try {
      record = JSON.parse(line) as OpenMathRagRecord;
    } catch (error) {
      throw new Error(`Failed to parse RAG JSONL ${jsonlPath}:${lineNumber}: ${String(error)}`);
    }

    if (record.quality?.is_usable === false) {
      continue;
    }

    rows.push(toIndexedProblem(record));
  }

  return rows;
}

function toIndexedProblem(record: OpenMathRagRecord): IndexedProblem {
  const problem: SourceProblem = {
    item_id: record.id.problem_id,
    source_dataset: record.id.source_dataset,
    split: record.id.split,
    source_label_type: record.id.source_label_type ?? "",
    school_level: record.curriculum.school_level,
    grade: record.curriculum.grade,
    semester: record.curriculum.semester ?? null,
    topic_code: record.curriculum.topic_code ?? null,
    topic_name: record.curriculum.topic_name,
    achievement_standard: record.curriculum.achievement_standard ?? null,
    question_text: record.problem.question_text,
    answer_text: record.problem.answer_text,
    explanation_text: record.problem.explanation_text ?? null,
    choice_blocks: record.problem.choice_blocks ?? null,
    problem_type_norm: record.problem.problem_type,
    difficulty_norm: record.problem.difficulty,
    question_image_relpath: record.media?.question_image_relpath ?? null,
    answer_image_relpath: record.media?.answer_image_relpath ?? null,
    question_json_relpath: record.source_trace?.original_question_json_relpath ?? null,
    answer_json_relpath: record.source_trace?.original_answer_json_relpath ?? null,
  };

  return {
    problem,
    retrievalText: record.rag?.retrieval_text ?? "",
    embeddingText: record.rag?.embedding_text ?? "",
    achievementConfidence: record.curriculum.achievement_confidence ?? 0,
    primaryTypeId: record.taxonomy?.primary_type_id,
    primarySubtypeId: record.taxonomy?.primary_subtype_id,
    typeIds: record.taxonomy?.type_ids ?? [],
    subtypeIds: record.taxonomy?.subtype_ids ?? [],
  };
}

function matchesQuery(
  row: IndexedProblem,
  query: RagQuery,
  minAchievementConfidence: number,
): boolean {
  const problem = row.problem;
  if (row.achievementConfidence < minAchievementConfidence) {
    return false;
  }
  if (problem.school_level !== query.school_level) {
    return false;
  }
  if (query.grade !== null && problem.grade !== query.grade) {
    return false;
  }
  if (query.topic_code && problem.topic_code !== query.topic_code) {
    return false;
  }
  if (query.problem_type && problem.problem_type_norm !== query.problem_type) {
    return false;
  }
  if (query.difficulty && problem.difficulty_norm !== query.difficulty) {
    return false;
  }
  if (
    query.topic_name &&
    !containsNormalized(searchableText(row), query.topic_name) &&
    tokenOverlap(query.topic_name, searchableText(row)) === 0
  ) {
    return false;
  }

  return true;
}

function scoreProblem(row: IndexedProblem, query: RagQuery, sourceMatch: boolean): number {
  let score = 0.2;
  const problem = row.problem;

  if (query.topic_code && problem.topic_code === query.topic_code) {
    score += 0.25;
  }
  if (query.topic_name) {
    score += tokenOverlap(query.topic_name, searchableText(row)) * 0.35;
  }
  if (query.intent) {
    score += tokenOverlap(
      [
        query.intent.objective_code,
        query.intent.objective_description,
        ...query.intent.required_techniques,
        ...query.intent.evaluation_dimensions.map((d) => d.description),
      ].join(" "),
      searchableText(row),
    ) * 0.3;
  }
  if (query.problem_type && problem.problem_type_norm === query.problem_type) {
    score += 0.1;
  }
  if (query.difficulty && problem.difficulty_norm === query.difficulty) {
    score += 0.1;
  }
  if (sourceMatch) {
    score += 0.4;
  }

  return Math.min(score, 1);
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

function searchableText(row: IndexedProblem): string {
  return [
    row.problem.topic_code,
    row.problem.topic_name,
    row.problem.achievement_standard,
    row.problem.question_text,
    row.problem.answer_text,
    row.problem.explanation_text,
    row.retrievalText,
    row.embeddingText,
    row.primaryTypeId,
    row.primarySubtypeId,
    ...row.typeIds,
    ...row.subtypeIds,
  ]
    .filter(Boolean)
    .join("\n");
}

function containsNormalized(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle));
}

function tokenOverlap(query: string, target: string): number {
  const queryTokens = [...tokenize(query)];
  if (queryTokens.length === 0) {
    return 0;
  }

  const targetTokens = [...tokenize(target)];
  let overlap = 0;
  for (const token of queryTokens) {
    if (targetTokens.some((targetToken) => tokensMatch(token, targetToken))) {
      overlap += 1;
    }
  }

  return overlap / queryTokens.length;
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(/[^0-9a-zA-Z가-힣]+/u)
      .filter(Boolean),
  );
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokensMatch(queryToken: string, targetToken: string): boolean {
  return (
    queryToken === targetToken ||
    (queryToken.length >= 2 && targetToken.includes(queryToken)) ||
    (targetToken.length >= 2 && queryToken.includes(targetToken))
  );
}

function roundSimilarity(score: number): number {
  return Math.round(score * 10000) / 10000;
}
