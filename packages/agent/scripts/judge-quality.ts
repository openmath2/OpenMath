import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateObject } from "ai";
import { z } from "zod";

import { DEFAULT_MODELS } from "../src/config/models.js";
import { loadEnv } from "../src/config/env.js";
import { resolveLanguageModel } from "../src/tools/llm-provider.js";

type Mode = "structural" | "conceptual";
type Status = "PASS" | "WARN" | "FAIL";

type SweepRow = {
  readonly grade: number;
  readonly code: string;
  readonly name: string;
  readonly question: string;
  readonly answer: string;
  readonly status: string;
};

type Topic = {
  readonly code: string;
  readonly achievement: string;
};

type JudgeRow = SweepRow & {
  readonly mode: Mode;
  readonly status: Status;
  readonly scores: {
    readonly math_correctness: number;
    readonly topic_fit: number;
    readonly isomorphism_fit: number;
    readonly clarity: number;
  };
  readonly reasons: readonly string[];
  readonly suggested_revision: string | null;
};

const JudgeSchema = z.object({
  status: z.enum(["PASS", "WARN", "FAIL"]),
  scores: z.object({
    math_correctness: z.number().int().min(1).max(5),
    topic_fit: z.number().int().min(1).max(5),
    isomorphism_fit: z.number().int().min(1).max(5),
    clarity: z.number().int().min(1).max(5),
  }),
  reasons: z.array(z.string()).max(4),
  suggested_revision: z.string().nullable(),
});

const rootDir = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const args = parseArgs(process.argv.slice(2));
const topics = await loadTopics();
const env = loadEnv();
const kind = env.LLM_PROVIDER === "cliproxy" ? "openai-compatible" : env.LLM_PROVIDER;
const modelId = env.LLM_MODEL ?? env.CLIPROXY_MODEL ?? env.OPENAI_MODEL ?? DEFAULT_MODELS.generator;
const model = resolveLanguageModel({
  kind,
  modelId,
  baseUrl: env.LLM_BASE_URL ?? env.CLIPROXY_BASE_URL,
  apiKey: env.LLM_API_KEY ?? env.CLIPROXY_API_KEY ?? env.OPENAI_API_KEY ?? "openmath-local",
  allowedHosts: ["localhost", "127.0.0.1"],
});

const rows = [
  ...await loadSweep(args.structural, "structural"),
  ...await loadSweep(args.conceptual, "conceptual"),
];
const judged = await runPool(rows, args.concurrency, (row) => judge(row, topics));
const report = {
  generated_at: new Date().toISOString(),
  structural_report: args.structural,
  conceptual_report: args.conceptual,
  total: judged.length,
  pass: judged.filter((row) => row.status === "PASS").length,
  warn: judged.filter((row) => row.status === "WARN").length,
  fail: judged.filter((row) => row.status === "FAIL").length,
  rows: judged,
};

const stamp = report.generated_at.replaceAll(":", "").replaceAll(".", "");
const outDir = join(rootDir, "reports/quality");
await mkdir(outDir, { recursive: true });
const jsonPath = join(outDir, `quality-judge-${stamp}.json`);
const mdPath = join(outDir, `quality-judge-${stamp}.md`);
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(mdPath, renderMarkdown(report.rows));
console.log(`JUDGE PASS ${report.pass}/${report.total} WARN ${report.warn} FAIL ${report.fail}`);
console.log(mdPath);
console.log(jsonPath);
if (report.fail > 0) process.exitCode = 1;

function parseArgs(argv: readonly string[]): { readonly structural: string; readonly conceptual: string; readonly concurrency: number } {
  let structural = "";
  let conceptual = "";
  let concurrency = 3;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--structural" && next !== undefined) {
      structural = resolve(rootDir, next);
      index += 1;
    } else if (arg === "--conceptual" && next !== undefined) {
      conceptual = resolve(rootDir, next);
      index += 1;
    } else if (arg === "--concurrency" && next !== undefined) {
      concurrency = Number.parseInt(next, 10);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg ?? ""}`);
    }
  }
  if (structural.length === 0 || conceptual.length === 0) throw new Error("--structural and --conceptual are required");
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error("--concurrency must be between 1 and 8");
  return { structural, conceptual, concurrency };
}

async function loadTopics(): Promise<ReadonlyMap<string, Topic>> {
  const source = await readFile(join(rootDir, "packages/web/app/app/new/topic/data.ts"), "utf8");
  const pattern = /\{\s*grade:\s*(?:1|2|3),\s*category:\s*"[^"]+",\s*code:\s*"([^"]+)",\s*name:\s*"[^"]+",\s*achievement:\s*"([^"]+)",\s*\}/gms;
  return new Map(Array.from(source.matchAll(pattern)).map((match) => [
    match[1] ?? "",
    { code: match[1] ?? "", achievement: (match[2] ?? "").replace(/\s+/g, " ").trim() },
  ]));
}

async function loadSweep(path: string, mode: Mode): Promise<readonly (SweepRow & { readonly mode: Mode })[]> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as { readonly rows?: readonly SweepRow[] };
  const rows = parsed.rows ?? [];
  if (rows.length !== 30) throw new Error(`${path} must contain 30 rows`);
  return rows.map((row) => ({ ...row, mode }));
}

async function judge(row: SweepRow & { readonly mode: Mode }, topics: ReadonlyMap<string, Topic>): Promise<JudgeRow> {
  const topic = topics.get(row.code);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { object } = await generateObject({
        model,
        schema: JudgeSchema,
        mode: "json",
        temperature: 0,
        prompt: renderPrompt(row, topic?.achievement ?? "", attempt),
      });
      return { ...row, ...object };
    } catch (error) {
      if (attempt === 2) {
        return fallbackJudge(row, error);
      }
    }
  }
  return fallbackJudge(row, new Error("unreachable judge retry state"));
}

function renderPrompt(row: SweepRow & { readonly mode: Mode }, achievement: string, attempt: number): string {
  return [
    "너는 한국 중학교 수학 출제 품질을 엄격히 검수하는 교사다.",
    "문항을 PASS/WARN/FAIL로 판정하라.",
    "PASS는 바로 학생에게 제공 가능, WARN은 사용 가능하지만 개선 권장, FAIL은 오답/단원 불일치/동형성 실패/애매한 문항이다.",
    "구조동형은 풀이 구조가 같은지, 개념동형은 같은 성취기준 안에서 상황/표현/풀이 관점이 충분히 바뀌었는지 평가하라.",
    "자동 검증은 이미 통과했으므로, 교육 품질과 문장 명확성에 집중하라.",
    "JSON 문자열에는 백슬래시, LaTeX, \\( \\), \\sqrt 같은 표기를 절대 쓰지 말고 plain Korean text만 써라.",
    attempt === 1 ? "" : "이전 응답은 JSON 파싱에 실패했다. 이번에는 reasons와 suggested_revision에 백슬래시를 절대 넣지 마라.",
    "",
    `학년: ${row.grade}`,
    `단원: ${row.code} ${row.name}`,
    `성취기준: ${achievement}`,
    `모드: ${row.mode}`,
    `문제: ${row.question}`,
    `정답: ${row.answer}`,
  ].join("\n");
}

function fallbackJudge(row: SweepRow & { readonly mode: Mode }, error: unknown): JudgeRow {
  const message = error instanceof Error ? error.message : String(error);
  return {
    ...row,
    status: "WARN",
    scores: { math_correctness: 3, topic_fit: 3, isomorphism_fit: 3, clarity: 3 },
    reasons: [`LLM judge parse failed: ${message.slice(0, 120)}`],
    suggested_revision: "Judge 응답 파싱 실패. 사람이 직접 확인해야 합니다.",
  };
}

async function runPool<T, R>(items: readonly T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runNext()));
  return results;
}

function renderMarkdown(rows: readonly JudgeRow[]): string {
  const lines = [
    "# OpenMath LLM Quality Judge",
    "",
    "| Grade | Code | Topic | Mode | Status | Scores | Reasons | Suggested Revision | Question | Answer |",
    "|---:|---|---|---|---|---|---|---|---|---|",
  ];
  for (const row of rows) {
    lines.push(`| ${row.grade} | ${row.code} | ${escapeMd(row.name)} | ${row.mode} | ${row.status} | ${scoreText(row)} | ${escapeMd(row.reasons.join("; "))} | ${escapeMd(row.suggested_revision ?? "")} | ${escapeMd(row.question)} | ${escapeMd(row.answer)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function scoreText(row: JudgeRow): string {
  const s = row.scores;
  return `math ${s.math_correctness}, topic ${s.topic_fit}, iso ${s.isomorphism_fit}, clarity ${s.clarity}`;
}

function escapeMd(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ").slice(0, 260);
}
