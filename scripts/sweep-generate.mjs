import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

const options = parseArgs(process.argv.slice(2));
const topics = await loadTopics();
const selectedTopics = options.only.size === 0
  ? topics
  : topics.filter((topic) => options.only.has(topic.code));

if (selectedTopics.length === 0) {
  throw new Error("No topics selected");
}

const startedAt = new Date();
const rows = [];

for (let run = 1; run <= options.repeats; run += 1) {
  const results = await runPool(selectedTopics, options.concurrency, (topic) =>
    runTopic(topic, run, options),
  );
  rows.push(...results);
}

const finishedAt = new Date();
const report = {
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  endpoint: options.endpoint,
  concurrency: options.concurrency,
  repeats: options.repeats,
  total: rows.length,
  pass: rows.filter((row) => row.status === "PASS").length,
  fail: rows.filter((row) => row.status === "FAIL").length,
  rows,
};

const stamp = startedAt.toISOString().replaceAll(":", "").replaceAll(".", "");
const outDir = join(rootDir, options.outDir);
await mkdir(outDir, { recursive: true });
const jsonPath = join(outDir, `generate-sweep-${stamp}.json`);
const mdPath = join(outDir, `generate-sweep-${stamp}.md`);
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(mdPath, renderMarkdown(report));

console.log(`PASS ${report.pass}/${report.total}`);
console.log(mdPath);
console.log(jsonPath);

if (report.fail > 0) {
  process.exitCode = 1;
}

function parseArgs(args) {
  const parsed = {
    endpoint: "http://localhost:3000",
    concurrency: 5,
    repeats: 1,
    timeoutMs: 240_000,
    mode: "structural",
    dims: ["A", "C"],
    only: new Set(),
    outDir: "reports/sweeps",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--") {
      continue;
    } else if (arg === "--endpoint" && next !== undefined) {
      parsed.endpoint = next;
      index += 1;
    } else if (arg === "--concurrency" && next !== undefined) {
      parsed.concurrency = parsePositiveInt(next, "concurrency");
      index += 1;
    } else if (arg === "--repeats" && next !== undefined) {
      parsed.repeats = parsePositiveInt(next, "repeats");
      index += 1;
    } else if (arg === "--timeout-ms" && next !== undefined) {
      parsed.timeoutMs = parsePositiveInt(next, "timeout-ms");
      index += 1;
    } else if (arg === "--mode" && next !== undefined) {
      if (next !== "structural" && next !== "conceptual") throw new Error(`Invalid mode: ${next}`);
      parsed.mode = next;
      index += 1;
    } else if (arg === "--dims" && next !== undefined) {
      parsed.dims = next.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
      index += 1;
    } else if (arg === "--only" && next !== undefined) {
      parsed.only = new Set(next.split(",").map((item) => item.trim()).filter((item) => item.length > 0));
      index += 1;
    } else if (arg === "--out-dir" && next !== undefined) {
      parsed.outDir = next;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function parsePositiveInt(raw, name) {
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return value;
}

async function loadTopics() {
  const source = await readFile(join(rootDir, "packages/web/app/app/new/topic/data.ts"), "utf8");
  const pattern = /\{\s*grade:\s*(1|2|3),\s*category:\s*"([^"]+)",\s*code:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*achievement:\s*"([^"]+)",\s*\}/gms;
  const matches = Array.from(source.matchAll(pattern));
  const loaded = matches.map((match) => ({
    grade: Number.parseInt(match[1], 10),
    category: match[2],
    code: match[3],
    name: match[4],
    achievement: match[5].replace(/\s+/g, " ").trim(),
  }));
  if (loaded.length !== 30) {
    throw new Error(`Expected 30 app topics, found ${loaded.length}`);
  }
  return loaded;
}

async function runPool(items, limit, worker) {
  const results = [];
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

async function runTopic(topic, run, opts) {
  const startedAt = Date.now();
  const steps = [];
  const errors = [];
  let candidates = [];

  try {
    const response = await fetch(`${opts.endpoint.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        grade: topic.grade,
        topic: topic.code,
        topic_name: topic.name,
        mode: opts.mode,
        dims: opts.dims,
        source_problem_text: topic.achievement,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });

    if (!response.ok) {
      return failRow(topic, run, startedAt, "http", `${response.status} ${response.statusText}`, steps, candidates);
    }
    if (response.body === null) {
      return failRow(topic, run, startedAt, "stream", "Response body is empty", steps, candidates);
    }

    await readSse(response.body, (event) => {
      if (event.name === "step" && isObject(event.data)) {
        steps.push(event.data);
      } else if (event.name === "result" && Array.isArray(event.data)) {
        candidates = event.data;
      } else if (event.name === "error" && isObject(event.data)) {
        errors.push(event.data);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failRow(topic, run, startedAt, "exception", message, steps, candidates);
  }

  const pass = candidates.some((candidate) => isObject(candidate) && candidate.verification_status === "pass");
  if (pass) {
    return passRow(topic, run, startedAt, steps, candidates);
  }

  const failedStep = [...steps].reverse().find((step) => step.status === "failed");
  const error = errors.at(-1);
  const stage = stringField(failedStep, "name") ?? stringField(error, "stage") ?? "result";
  const reason = stringField(failedStep, "summary") ?? stringField(error, "message") ?? "No passing candidate returned";
  return failRow(topic, run, startedAt, stage, reason, steps, candidates);
}

async function readSse(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
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
  const event = parseFrame(buffer);
  if (event !== null) onEvent(event);
}

function parseFrame(frame) {
  const eventLine = frame.split("\n").find((line) => line.startsWith("event:"));
  const dataLines = frame.split("\n").filter((line) => line.startsWith("data:"));
  if (eventLine === undefined || dataLines.length === 0) return null;
  const name = eventLine.slice("event:".length).trim();
  const rawData = dataLines.map((line) => line.slice("data:".length).trim()).join("\n");
  try {
    return { name, data: JSON.parse(rawData) };
  } catch {
    return { name, data: rawData };
  }
}

function passRow(topic, run, startedAt, steps, candidates) {
  const candidate = candidates.find((item) => isObject(item) && item.verification_status === "pass");
  return baseRow(topic, run, startedAt, "PASS", "", "", steps, candidate);
}

function failRow(topic, run, startedAt, stage, reason, steps, candidates) {
  const candidate = candidates.find((item) => isObject(item)) ?? null;
  return baseRow(topic, run, startedAt, "FAIL", stage, reason, steps, candidate);
}

function baseRow(topic, run, startedAt, status, failedStage, failureReason, steps, candidate) {
  return {
    run,
    grade: topic.grade,
    code: topic.code,
    name: topic.name,
    category: topic.category,
    status,
    failed_stage: failedStage,
    failure_reason: failureReason,
    duration_ms: Date.now() - startedAt,
    step_statuses: steps.map((step) => ({
      index: numberField(step, "index"),
      name: stringField(step, "name"),
      status: stringField(step, "status"),
      summary: stringField(step, "summary"),
    })),
    question: stringField(candidate, "question_latex") ?? "",
    answer: stringField(candidate, "answer_latex") ?? "",
    source_refs: stringArrayField(candidate, "source_refs"),
    verification_status: stringField(candidate, "verification_status") ?? "",
  };
}

function renderMarkdown(report) {
  const lines = [
    "# OpenMath Generate Sweep",
    "",
    `- Started: ${report.started_at}`,
    `- Finished: ${report.finished_at}`,
    `- Endpoint: ${report.endpoint}`,
    `- Concurrency: ${report.concurrency}`,
    `- Repeats: ${report.repeats}`,
    `- Result: ${report.pass}/${report.total} PASS`,
    "",
    "| Run | Grade | Code | Topic | Status | Failed Stage | Failure Reason | RAG Refs | Question | Answer | Duration |",
    "|---:|---:|---|---|---|---|---|---|---|---|---:|",
  ];

  for (const row of report.rows) {
    lines.push([
      row.run,
      row.grade,
      row.code,
      escapeMd(row.name),
      row.status,
      escapeMd(row.failed_stage),
      escapeMd(row.failure_reason),
      escapeMd(row.source_refs.join(", ")),
      escapeMd(row.question),
      escapeMd(row.answer),
      row.duration_ms,
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }

  return `${lines.join("\n")}\n`;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value, key) {
  if (!isObject(value)) return null;
  const field = value[key];
  return typeof field === "string" ? field : null;
}

function numberField(value, key) {
  if (!isObject(value)) return null;
  const field = value[key];
  return typeof field === "number" ? field : null;
}

function stringArrayField(value, key) {
  if (!isObject(value)) return [];
  const field = value[key];
  if (!Array.isArray(field)) return [];
  return field.filter((item) => typeof item === "string");
}

function escapeMd(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ")
    .slice(0, 240);
}
