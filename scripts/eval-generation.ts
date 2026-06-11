import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Mode = "structural" | "conceptual";
type Grade = 1 | 2 | 3;

type GateName =
  | "rag"
  | "intent"
  | "generate"
  | "sympy_verify"
  | "re_solve"
  | "objective_map";

type GateStatus = "passed" | "failed" | "skipped" | "unverified";
type Overall = "verified" | "rejected" | "warning" | "missing";
type VerificationStatus = "pass" | "partial" | "fail" | "missing";

type Topic = {
  readonly grade: Grade;
  readonly category: string;
  readonly code: string;
  readonly name: string;
  readonly achievement: string;
};

type Options = {
  endpoint: string;
  repeats: number;
  concurrency: number;
  timeoutMs: number;
  dims: string[];
  only: Set<string>;
  outDir: string;
};

type SseEvent = { readonly name: string; readonly data: unknown };

type WireGate = {
  step: GateName;
  status: "passed" | "failed" | "skipped";
  duration_ms: number;
  failure_code?: string;
  failure_message?: string;
};

type WireProblem = {
  id?: string;
  question_latex?: string;
  answer_latex?: string;
  verification_status?: "pass" | "partial" | "fail";
  overall?: "verified" | "rejected" | "warning";
  gates?: WireGate[];
  attempt_count?: number;
  generation_model?: string;
  refined_by?: string[];
  isomorphism?: Mode;
  preserved_dimensions?: string[];
  source_refs?: string[];
};

type EvalRow = {
  code: string;
  grade: Grade;
  name: string;
  mode: Mode;
  run: number;
  overall: Overall;
  verification_status: VerificationStatus;
  gates: Record<GateName, GateStatus>;
  failed_gate: GateName | null;
  failure_code: string | null;
  failure_message: string | null;
  attempt_count: number | null;
  generation_model: string;
  refined_by: string[];
  duration_ms: number;
  question_latex: string;
  answer_latex: string;
  error: string | null;
};

type RunReport = {
  started_at: string;
  finished_at: string;
  endpoint: string;
  concurrency: number;
  repeats: number;
  dims: string[];
  total: number;
  deterministic_fallback_env: string;
  rows: EvalRow[];
};

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

const DEMO_UNIT_CODES: readonly string[] = [
  "9수01-01",
  "9수01-05",
  "9수02-01",
  "9수02-03",
  "9수02-06",
  "9수02-07",
  "9수02-08",
  "9수02-09",
  "9수02-10",
  "9수03-02",
  "9수03-04",
  "9수04-05",
] as const;

const MODES: readonly Mode[] = ["structural", "conceptual"] as const;

const GATE_NAMES: readonly GateName[] = [
  "rag",
  "intent",
  "generate",
  "sympy_verify",
  "re_solve",
  "objective_map",
] as const;

const HELP_TEXT = `OpenMath generation eval harness

Usage:
  npx tsx scripts/eval-generation.ts [options]

Options:
  --endpoint <url>          Agent endpoint (default: http://localhost:31415)
  --repeats <int>           Repeats per (unit, mode) (default: 5)
  --concurrency <int>       Parallel in-flight requests (default: 3)
  --timeout-ms <int>        Per-request timeout (default: 240000)
  --dims <csv>              Comma-separated dim codes (default: A,C)
  --only <csv>              Subset of unit codes (default: all 12)
  --out-dir <path>          Report dir relative to repo root (default: reports/eval)
  --help                    Show this message and exit

The matrix is units × {structural, conceptual} × repeats.
Outputs <out-dir>/eval-generation-<stamp>.{jsonl,md}.
`;

await main();

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const topicsAll = await loadTopics();
  const demoTopics = filterDemoTopics(topicsAll);
  const selected = options.only.size === 0
    ? demoTopics
    : demoTopics.filter((topic) => options.only.has(topic.code));

  if (selected.length === 0) {
    throw new Error(
      `No topics selected. --only=${[...options.only].join(",")} did not match any of the 12 demo codes.`,
    );
  }

  const tasks: ReadonlyArray<{ topic: Topic; mode: Mode; run: number }> = (() => {
    const out: { topic: Topic; mode: Mode; run: number }[] = [];
    for (let run = 1; run <= options.repeats; run += 1) {
      for (const topic of selected) {
        for (const mode of MODES) {
          out.push({ topic, mode, run });
        }
      }
    }
    return out;
  })();

  const startedAt = new Date();
  const rows = await runPool(tasks, options.concurrency, (task) =>
    runOne(task.topic, task.mode, task.run, options),
  );
  const finishedAt = new Date();

  const report: RunReport = {
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    endpoint: options.endpoint,
    concurrency: options.concurrency,
    repeats: options.repeats,
    dims: options.dims,
    total: rows.length,
    deterministic_fallback_env:
      process.env["DETERMINISTIC_FALLBACK"] ?? "(not set; agent uses its own env)",
    rows,
  };

  const stamp = startedAt.toISOString().replaceAll(":", "").replaceAll(".", "");
  const outDir = join(rootDir, options.outDir);
  await mkdir(outDir, { recursive: true });
  const jsonlPath = join(outDir, `eval-generation-${stamp}.jsonl`);
  const mdPath = join(outDir, `eval-generation-${stamp}.md`);

  const jsonlBody = rows.map((row) => JSON.stringify(row)).join("\n");
  await writeFile(jsonlPath, jsonlBody.length === 0 ? "" : `${jsonlBody}\n`);
  await writeFile(mdPath, renderMarkdown(report));

  const verified = rows.filter((row) => row.overall === "verified").length;
  const fallbackRuns = rows.filter((row) =>
    row.refined_by.includes("deterministic-topic-generator"),
  ).length;
  const verifiedPct = formatPercent(verified, rows.length);
  const fallbackPct = formatPercent(fallbackRuns, rows.length);

  console.log(`verified: ${verified}/${rows.length} (${verifiedPct})`);
  console.log(`template-fallback: ${fallbackRuns}/${rows.length} (${fallbackPct})`);
  console.log(`jsonl: ${jsonlPath}`);
  console.log(`md:    ${mdPath}`);
}

function parseArgs(args: readonly string[]): Options {
  const parsed: Options = {
    endpoint: "http://localhost:31415",
    repeats: 5,
    concurrency: 3,
    timeoutMs: 240_000,
    dims: ["A", "C"],
    only: new Set<string>(),
    outDir: "reports/eval",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      console.log(HELP_TEXT);
      process.exit(0);
    } else if (arg === "--") {
      continue;
    } else if (arg === "--endpoint" && next !== undefined) {
      parsed.endpoint = next;
      index += 1;
    } else if (arg === "--repeats" && next !== undefined) {
      parsed.repeats = parsePositiveInt(next, "repeats");
      index += 1;
    } else if (arg === "--concurrency" && next !== undefined) {
      parsed.concurrency = parsePositiveInt(next, "concurrency");
      index += 1;
    } else if (arg === "--timeout-ms" && next !== undefined) {
      parsed.timeoutMs = parsePositiveInt(next, "timeout-ms");
      index += 1;
    } else if (arg === "--dims" && next !== undefined) {
      parsed.dims = splitCsv(next);
      if (parsed.dims.length === 0) {
        throw new Error("--dims must contain at least one value");
      }
      index += 1;
    } else if (arg === "--only" && next !== undefined) {
      parsed.only = new Set(splitCsv(next));
      index += 1;
    } else if (arg === "--out-dir" && next !== undefined) {
      parsed.outDir = next;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${String(arg)} (try --help)`);
    }
  }

  return parsed;
}

function parsePositiveInt(raw: string, name: string): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return value;
}

function splitCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

async function loadTopics(): Promise<Topic[]> {
  const source = await readFile(
    join(rootDir, "packages/web/app/app/new/topic/data.ts"),
    "utf8",
  );
  // Same regex as scripts/sweep-generate.mjs::loadTopics.
  const pattern =
    /\{\s*schoolLevel:\s*"middle",\s*grade:\s*(1|2|3),\s*course:\s*"[^"]+",\s*category:\s*"([^"]+)",\s*code:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*achievement:\s*\n?\s*"([^"]+)",\s*\}/gms;
  const matches = Array.from(source.matchAll(pattern));
  const loaded: Topic[] = matches.map((match) => ({
    grade: parseGradeStrict(match[1] ?? ""),
    category: match[2] ?? "",
    code: match[3] ?? "",
    name: match[4] ?? "",
    achievement: (match[5] ?? "").replace(/\s+/g, " ").trim(),
  }));
  if (loaded.length === 0) {
    throw new Error(
      "Failed to parse any middle-school topics from packages/web/app/app/new/topic/data.ts",
    );
  }
  return loaded;
}

function parseGradeStrict(raw: string): Grade {
  if (raw === "1") return 1;
  if (raw === "2") return 2;
  if (raw === "3") return 3;
  throw new Error(`Invalid grade in topic data: ${raw}`);
}

function filterDemoTopics(all: readonly Topic[]): Topic[] {
  const byCode = new Map<string, Topic>();
  for (const topic of all) {
    byCode.set(topic.code, topic);
  }
  const missing = DEMO_UNIT_CODES.filter((code) => !byCode.has(code));
  if (missing.length > 0) {
    throw new Error(
      `Missing demo unit codes in topic data: ${missing.join(", ")}`,
    );
  }
  return DEMO_UNIT_CODES.map((code) => {
    const topic = byCode.get(code);
    if (topic === undefined) {
      throw new Error(`Demo code disappeared after presence check: ${code}`);
    }
    return topic;
  });
}

async function runPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let cursor = 0;

  async function next(): Promise<void> {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      const item = items[current];
      if (item === undefined) continue;
      results[current] = await worker(item);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => next(),
  );
  await Promise.all(workers);
  return results;
}

async function runOne(
  topic: Topic,
  mode: Mode,
  run: number,
  opts: Options,
): Promise<EvalRow> {
  const startedAt = Date.now();
  const errors: { stage: string; message: string }[] = [];
  let candidates: unknown[] = [];

  try {
    const response = await fetch(
      `${opts.endpoint.replace(/\/$/, "")}/api/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          grade: topic.grade,
          topic: topic.code,
          topic_name: topic.name,
          mode,
          dims: opts.dims,
          source_problem_text: topic.achievement,
        }),
        signal: AbortSignal.timeout(opts.timeoutMs),
      },
    );

    if (!response.ok) {
      return buildRow(topic, mode, run, startedAt, null, {
        kind: "http",
        message: `${response.status} ${response.statusText}`,
      });
    }
    if (response.body === null) {
      return buildRow(topic, mode, run, startedAt, null, {
        kind: "stream",
        message: "Response body is empty",
      });
    }

    await readSse(response.body, (event) => {
      if (event.name === "result" && Array.isArray(event.data)) {
        candidates = event.data;
      } else if (event.name === "error" && isObject(event.data)) {
        errors.push({
          stage: stringField(event.data, "stage") ?? "unknown",
          message: stringField(event.data, "message") ?? "(no message)",
        });
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildRow(topic, mode, run, startedAt, null, {
      kind: "exception",
      message,
    });
  }

  const problem = pickCanonicalProblem(candidates);
  if (problem === null) {
    const lastError = errors.at(-1);
    return buildRow(topic, mode, run, startedAt, null, {
      kind: "no-result",
      message:
        lastError === undefined
          ? "No result event arrived; pipeline produced no candidates"
          : `${lastError.stage}: ${lastError.message}`,
    });
  }

  return buildRow(topic, mode, run, startedAt, problem, null);
}

function pickCanonicalProblem(candidates: readonly unknown[]): WireProblem | null {
  // Prefer the first verified candidate; otherwise fall back to the first
  // shape-matching candidate. Empty / non-object entries are skipped.
  const objects = candidates.filter((c): c is Record<string, unknown> =>
    isObject(c),
  );
  if (objects.length === 0) return null;
  const verified = objects.find(
    (obj) => stringField(obj, "overall") === "verified",
  );
  return parseWireProblem(verified ?? objects[0] ?? null);
}

function parseWireProblem(raw: Record<string, unknown> | null): WireProblem | null {
  if (raw === null) return null;
  return {
    id: stringField(raw, "id") ?? undefined,
    question_latex: stringField(raw, "question_latex") ?? undefined,
    answer_latex: stringField(raw, "answer_latex") ?? undefined,
    verification_status: parseVerificationStatus(stringField(raw, "verification_status")),
    overall: parseOverallVerdict(stringField(raw, "overall")),
    gates: parseGates(raw["gates"]),
    attempt_count: numberField(raw, "attempt_count") ?? undefined,
    generation_model: stringField(raw, "generation_model") ?? undefined,
    refined_by: stringArrayField(raw, "refined_by"),
    isomorphism: parseMode(stringField(raw, "isomorphism")),
    preserved_dimensions: stringArrayField(raw, "preserved_dimensions"),
    source_refs: stringArrayField(raw, "source_refs"),
  };
}

function parseGates(raw: unknown): WireGate[] {
  if (!Array.isArray(raw)) return [];
  const out: WireGate[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const step = stringField(entry, "step");
    const status = stringField(entry, "status");
    const duration = numberField(entry, "duration_ms");
    if (!isGateName(step)) continue;
    if (status !== "passed" && status !== "failed" && status !== "skipped") continue;
    out.push({
      step,
      status,
      duration_ms: duration ?? 0,
      failure_code: stringField(entry, "failure_code") ?? undefined,
      failure_message: stringField(entry, "failure_message") ?? undefined,
    });
  }
  return out;
}

function parseVerificationStatus(
  raw: string | null,
): "pass" | "partial" | "fail" | undefined {
  if (raw === "pass" || raw === "partial" || raw === "fail") return raw;
  return undefined;
}

function parseOverallVerdict(
  raw: string | null,
): "verified" | "rejected" | "warning" | undefined {
  if (raw === "verified" || raw === "rejected" || raw === "warning") return raw;
  return undefined;
}

function parseMode(raw: string | null): Mode | undefined {
  if (raw === "structural" || raw === "conceptual") return raw;
  return undefined;
}

function isGateName(value: string | null): value is GateName {
  return value !== null && (GATE_NAMES as readonly string[]).includes(value);
}

type FailureContext = { kind: string; message: string };

function buildRow(
  topic: Topic,
  mode: Mode,
  run: number,
  startedAtMs: number,
  problem: WireProblem | null,
  failure: FailureContext | null,
): EvalRow {
  const gateMap: Record<GateName, GateStatus> = {
    rag: "unverified",
    intent: "unverified",
    generate: "unverified",
    sympy_verify: "unverified",
    re_solve: "unverified",
    objective_map: "unverified",
  };

  const gates = problem?.gates ?? [];
  for (const gate of gates) {
    gateMap[gate.step] = gate.status;
  }

  const failedGate =
    gates.find((g) => g.status === "failed") ?? null;

  const overallFromWire = problem?.overall ?? null;
  const verificationFromWire = problem?.verification_status ?? null;

  // Failure precedence:
  // 1) Transport / shape-level failure → error stamped, gates stay unverified.
  // 2) Wire-level failed gate → failure_code/message from that gate.
  // 3) Otherwise null.
  let failureCode: string | null = null;
  let failureMessage: string | null = null;
  let topLevelError: string | null = null;

  if (failure !== null) {
    failureCode = failure.kind;
    failureMessage = failure.message;
    topLevelError = `${failure.kind}: ${failure.message}`;
  } else if (failedGate !== null) {
    failureCode = failedGate.failure_code ?? null;
    failureMessage = failedGate.failure_message ?? null;
  }

  return {
    code: topic.code,
    grade: topic.grade,
    name: topic.name,
    mode,
    run,
    overall: overallFromWire ?? "missing",
    verification_status: verificationFromWire ?? "missing",
    gates: gateMap,
    failed_gate: failedGate === null ? null : failedGate.step,
    failure_code: failureCode,
    failure_message: failureMessage,
    attempt_count: problem?.attempt_count ?? null,
    generation_model: problem?.generation_model ?? "unknown",
    refined_by: problem?.refined_by ?? [],
    duration_ms: Date.now() - startedAtMs,
    question_latex: problem?.question_latex ?? "",
    answer_latex: problem?.answer_latex ?? "",
    error: topLevelError,
  };
}

async function readSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const read = await reader.read();
    if (read.done) break;
    buffer += decoder.decode(read.value, { stream: true });
    const frames = buffer.split(/\n\s*\n/u);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const event = parseFrame(frame);
      if (event !== null) onEvent(event);
    }
  }

  buffer += decoder.decode();
  const tail = parseFrame(buffer);
  if (tail !== null) onEvent(tail);
}

function parseFrame(frame: string): SseEvent | null {
  const lines = frame.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines.filter((line) => line.startsWith("data:"));
  if (eventLine === undefined || dataLines.length === 0) return null;
  const name = eventLine.slice("event:".length).trim();
  const rawData = dataLines
    .map((line) => line.slice("data:".length).trim())
    .join("\n");
  try {
    return { name, data: JSON.parse(rawData) as unknown };
  } catch {
    return { name, data: rawData };
  }
}

function renderMarkdown(report: RunReport): string {
  const lines: string[] = [];
  lines.push("# OpenMath Generation Eval", "");
  lines.push("## Run metadata", "");
  lines.push(`- Endpoint: \`${report.endpoint}\``);
  lines.push(`- Repeats per (unit, mode): ${report.repeats}`);
  lines.push(`- Concurrency: ${report.concurrency}`);
  lines.push(`- Dims: ${report.dims.join(", ")}`);
  lines.push(`- Started: ${report.started_at}`);
  lines.push(`- Finished: ${report.finished_at}`);
  lines.push(`- Total runs: ${report.total}`);
  lines.push(
    `- DETERMINISTIC_FALLBACK (harness env): \`${report.deterministic_fallback_env}\``,
  );
  lines.push("");

  lines.push("## Per-unit success", "");
  lines.push(
    "Success = `overall === \"verified\"`. Warning rows still expose a problem but with non-blocking gate warnings.",
  );
  lines.push("");
  lines.push(
    "| Unit | Name | Mode | Runs | Verified | Warning | Rejected | Missing | Success% |",
  );
  lines.push("|---|---|---|---:|---:|---:|---:|---:|---:|");
  for (const code of unitsInOrder(report.rows)) {
    for (const mode of MODES) {
      const subset = report.rows.filter((r) => r.code === code && r.mode === mode);
      if (subset.length === 0) continue;
      const sample = subset[0];
      if (sample === undefined) continue;
      const verified = subset.filter((r) => r.overall === "verified").length;
      const warning = subset.filter((r) => r.overall === "warning").length;
      const rejected = subset.filter((r) => r.overall === "rejected").length;
      const missing = subset.filter((r) => r.overall === "missing").length;
      lines.push(
        [
          `\`${code}\``,
          escapeMd(sample.name),
          mode,
          subset.length,
          verified,
          warning,
          rejected,
          missing,
          formatPercent(verified, subset.length),
        ]
          .join(" | ")
          .replace(/^/, "| ")
          .replace(/$/, " |"),
      );
    }
  }
  lines.push("");

  lines.push("## Per-gate pass rates", "");
  lines.push(
    "Computed over all runs. `unverified` = wire result missing that gate (transport failure, no-result, or shape drift).",
  );
  lines.push("");
  lines.push("| Gate | Passed% | Failed% | Skipped% | Unverified% |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const gate of GATE_NAMES) {
    const passed = report.rows.filter((r) => r.gates[gate] === "passed").length;
    const failed = report.rows.filter((r) => r.gates[gate] === "failed").length;
    const skipped = report.rows.filter((r) => r.gates[gate] === "skipped").length;
    const unverified = report.rows.filter(
      (r) => r.gates[gate] === "unverified",
    ).length;
    lines.push(
      [
        `\`${gate}\``,
        formatPercent(passed, report.total),
        formatPercent(failed, report.total),
        formatPercent(skipped, report.total),
        formatPercent(unverified, report.total),
      ]
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }
  lines.push("");

  lines.push("## refined_by distribution", "");
  lines.push(
    "Key regression metric — `deterministic-topic-generator` in `refined_by` means the template short-circuited the LLM (DETERMINISTIC_FALLBACK ≠ `off`).",
  );
  lines.push("");
  const fallbackRuns = report.rows.filter((r) =>
    r.refined_by.includes("deterministic-topic-generator"),
  ).length;
  const pureLlmRuns = report.rows.length - fallbackRuns;
  lines.push("| Pipeline | Count | Share% |");
  lines.push("|---|---:|---:|");
  lines.push(
    [
      "includes `deterministic-topic-generator`",
      fallbackRuns,
      formatPercent(fallbackRuns, report.total),
    ]
      .join(" | ")
      .replace(/^/, "| ")
      .replace(/$/, " |"),
  );
  lines.push(
    [
      "pure LLM (no template fallback)",
      pureLlmRuns,
      formatPercent(pureLlmRuns, report.total),
    ]
      .join(" | ")
      .replace(/^/, "| ")
      .replace(/$/, " |"),
  );

  const refinerCounts = countOccurrences(
    report.rows.flatMap((r) => r.refined_by),
  );
  if (refinerCounts.size > 0) {
    lines.push("");
    lines.push("### All refiners tallied (one per occurrence; runs may contribute multiple)", "");
    lines.push("| Refiner | Count |");
    lines.push("|---|---:|");
    for (const [name, count] of sortMapDesc(refinerCounts)) {
      lines.push(`| \`${escapeMd(name)}\` | ${count} |`);
    }
  }
  lines.push("");

  lines.push("## generation_model distribution", "");
  lines.push("");
  const modelCounts = countOccurrences(report.rows.map((r) => r.generation_model));
  lines.push("| Model | Count | Share% |");
  lines.push("|---|---:|---:|");
  for (const [model, count] of sortMapDesc(modelCounts)) {
    lines.push(
      [
        `\`${escapeMd(model)}\``,
        count,
        formatPercent(count, report.total),
      ]
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  }
  lines.push("");

  const failureRows = report.rows.filter(
    (r) => r.overall !== "verified" || r.error !== null,
  );
  if (failureRows.length > 0) {
    lines.push("## Non-verified runs (sample, capped at 50)", "");
    lines.push(
      "| Unit | Mode | Run | Overall | Failed gate | Code | Message |",
    );
    lines.push("|---|---|---:|---|---|---|---|");
    for (const row of failureRows.slice(0, 50)) {
      lines.push(
        [
          `\`${row.code}\``,
          row.mode,
          row.run,
          row.overall,
          row.failed_gate ?? "",
          escapeMd(row.failure_code ?? ""),
          escapeMd(row.failure_message ?? row.error ?? ""),
        ]
          .join(" | ")
          .replace(/^/, "| ")
          .replace(/$/, " |"),
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function unitsInOrder(rows: readonly EvalRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of DEMO_UNIT_CODES) {
    if (rows.some((r) => r.code === code)) {
      seen.add(code);
      out.push(code);
    }
  }
  // Any extras (shouldn't happen in normal flow) appended last in insertion order.
  for (const row of rows) {
    if (!seen.has(row.code)) {
      seen.add(row.code);
      out.push(row.code);
    }
  }
  return out;
}

function countOccurrences(values: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const value of values) {
    out.set(value, (out.get(value) ?? 0) + 1);
  }
  return out;
}

function sortMapDesc(map: Map<string, number>): [string, number][] {
  return [...map.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
}

function formatPercent(num: number, denom: number): string {
  if (denom === 0) return "0.0%";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

function escapeMd(value: string): string {
  return String(value)
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ")
    .slice(0, 240);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, key: string): string | null {
  if (!isObject(value)) return null;
  const field = value[key];
  return typeof field === "string" ? field : null;
}

function numberField(value: unknown, key: string): number | null {
  if (!isObject(value)) return null;
  const field = value[key];
  return typeof field === "number" && Number.isFinite(field) ? field : null;
}

function stringArrayField(value: unknown, key: string): string[] {
  if (!isObject(value)) return [];
  const field = value[key];
  if (!Array.isArray(field)) return [];
  return field.filter((item): item is string => typeof item === "string");
}
