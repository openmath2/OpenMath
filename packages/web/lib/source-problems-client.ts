/* ─────────────────────────────────────────────────────────────
 * source-problems-client — agent `/api/source-problems` 의 fetch 래퍼.
 *
 * Dual-use:
 *  (1) Server Component (intent/page.tsx) 가 SSR 초기 30개 fetch.
 *  (2) Client component (intent/picker.tsx) 가 difficulty 칩 클릭마다 refetch.
 *
 * 두 경우 모두 `fetch` + `process.env.NEXT_PUBLIC_AGENT_URL` 만 사용 — Next
 * 가 NEXT_PUBLIC_ 변수를 클라이언트 번들에 인라인하므로 별도 marker 불필요.
 * CORS 는 agent 가 :27182 에서 GET 허용.
 *
 * 본 모듈은 throw 하지 않는다. agent 부재·404·malformed body 모두
 * 빈 배열 + warn. UI 가 empty-state 또는 retry 를 자체적으로 그린다.
 * ──────────────────────────────────────────────────────────── */

export type Difficulty = "easy" | "medium" | "hard";

export type SourceProblem = {
  item_id: string;
  question_text: string;
  answer_text: string;
  topic_name: string;
  topic_code: string | null;
  difficulty_norm: Difficulty;
  problem_type_norm: string;
  explanation_text: string | null;
  choice_blocks: string[] | null;
};

function getAgentBaseUrl(): string {
  const env =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_AGENT_URL : undefined;
  return (env ?? "http://localhost:31415").replace(/\/$/, "");
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isDifficulty(v: unknown): v is Difficulty {
  return v === "easy" || v === "medium" || v === "hard";
}

function asStringArrayOrNull(v: unknown): string[] | null {
  if (v === null) return null;
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") return null;
    out.push(item);
  }
  return out;
}

function asSourceProblem(raw: unknown): SourceProblem | null {
  if (!isObject(raw)) return null;
  const {
    item_id,
    question_text,
    answer_text,
    topic_name,
    topic_code,
    difficulty_norm,
    problem_type_norm,
    explanation_text,
    choice_blocks,
  } = raw;

  if (typeof item_id !== "string" || item_id.length === 0) return null;
  if (typeof question_text !== "string") return null;
  if (typeof answer_text !== "string") return null;
  if (typeof topic_name !== "string") return null;
  if (topic_code !== null && typeof topic_code !== "string") return null;
  if (!isDifficulty(difficulty_norm)) return null;
  if (typeof problem_type_norm !== "string") return null;
  if (explanation_text !== null && typeof explanation_text !== "string") return null;

  const blocks =
    choice_blocks === undefined ? null : asStringArrayOrNull(choice_blocks);
  /* choice_blocks 는 string[] | null 이어야 하므로 undefined 도 null 로 강등. */

  return {
    item_id,
    question_text,
    answer_text,
    topic_name,
    topic_code,
    difficulty_norm,
    problem_type_norm,
    explanation_text,
    choice_blocks: blocks,
  };
}

type GetArgs = {
  schoolLevel: string;
  grade: number | null;
  topicCode: string;
  difficulty?: Difficulty;
  limit?: number;
};

export async function getSourceProblems(
  args: GetArgs,
): Promise<SourceProblem[]> {
  const params = new URLSearchParams();
  params.set("school_level", args.schoolLevel);
  params.set("grade", args.grade === null ? "null" : String(args.grade));
  params.set("topic_code", args.topicCode);
  if (args.difficulty !== undefined) {
    params.set("difficulty", args.difficulty);
  }
  const limit = args.limit === undefined ? 30 : args.limit;
  params.set("limit", String(limit));

  const url = `${getAgentBaseUrl()}/api/source-problems?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[source-problems] fetch failed for ${url}: ${reason}`);
    return [];
  }

  if (!response.ok) {
    console.warn(
      `[source-problems] non-2xx (${response.status} ${response.statusText}) for ${url}`,
    );
    return [];
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[source-problems] JSON parse failed for ${url}: ${reason}`);
    return [];
  }

  if (!Array.isArray(payload)) {
    console.warn(
      `[source-problems] expected array, received ${typeof payload} for ${url}`,
    );
    return [];
  }

  const out: SourceProblem[] = [];
  let skipped = 0;
  for (const item of payload) {
    const sp = asSourceProblem(item);
    if (sp === null) {
      skipped += 1;
      continue;
    }
    out.push(sp);
  }
  if (skipped > 0) {
    console.warn(
      `[source-problems] skipped ${skipped}/${payload.length} malformed entries for ${url}`,
    );
  }
  return out;
}
