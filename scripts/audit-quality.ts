import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { GenerateRequest, Intent, RagResult } from "../packages/agent/src/schemas/index.js";
import { deterministicInitialCandidate } from "../packages/agent/src/steps/problem-generation-deterministic.js";

type Mode = "structural" | "conceptual";
type Grade = 1 | 2 | 3;

type Topic = {
  readonly grade: Grade;
  readonly category: string;
  readonly code: string;
  readonly name: string;
  readonly achievement: string;
};

type AuditGrade = "PASS" | "WARN" | "FAIL";

type AuditRow = {
  readonly grade: Grade;
  readonly code: string;
  readonly name: string;
  readonly mode: Mode;
  readonly status: AuditGrade;
  readonly question: string;
  readonly answer: string;
  readonly reasons: readonly string[];
};

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const topicEvidenceAliases: Readonly<Record<string, readonly string[]>> = {
  "9수01-01": ["소인수", "소인수분해"],
  "9수01-02": ["유리수", "수직선", "대소", "절댓값", "더 큰 수", "-"],
  "9수01-03": ["분수", "기온", "+", "-"],
  "9수01-04": ["순환소수", "기약분수"],
  "9수01-05": ["제곱근", "sqrt"],
  "9수01-06": ["근호", "sqrt"],
  "9수02-01": ["식", "a", "b"],
  "9수02-02": ["일차식", "동류항"],
  "9수02-03": ["방정식", "어떤 수"],
  "9수02-04": ["방정식", "공책"],
  "9수02-05": ["다항식", "전개", "정리"],
  "9수02-06": ["부등식", "<", ">"],
  "9수02-07": ["연립", "x", "y", "사과", "배"],
  "9수02-08": ["인수분해", "직사각형", "넓이"],
  "9수02-09": ["이차방정식", "x**2"],
  "9수02-10": ["x**2", "방정식", "직사각형", "넓이", "두 수", "합", "곱"],
  "9수03-01": ["함수", "y =", "좌표", "요금"],
  "9수03-02": ["함수", "기울기", "절편", "변화량"],
  "9수03-03": ["요금", "택시", "x시간"],
  "9수03-04": ["이차함수", "꼭짓점", "열린다"],
  "9수04-01": ["도형", "점", "직선", "선분", "삼각형"],
  "9수04-02": ["삼각형", "각"],
  "9수04-03": ["직사각형", "평행사변형"],
  "9수04-04": ["닮음", "닮음비", "대응"],
  "9수04-05": ["직각삼각형", "sin", "빗변"],
  "9수04-06": ["원", "직선", "반지름"],
  "9수04-07": ["원주각", "중심각"],
  "9수05-01": ["도수", "상대도수"],
  "9수05-02": ["확률", "동전", "주사위"],
  "9수05-03": ["자료", "평균", "중앙값"],
};

const topics = await loadTopics();
const rows = topics.flatMap((topic) => (["structural", "conceptual"] as const).map((mode) => audit(topic, mode)));
const report = {
  generated_at: new Date().toISOString(),
  total: rows.length,
  pass: rows.filter((row) => row.status === "PASS").length,
  warn: rows.filter((row) => row.status === "WARN").length,
  fail: rows.filter((row) => row.status === "FAIL").length,
  rows,
};

const stamp = report.generated_at.replaceAll(":", "").replaceAll(".", "");
const outDir = join(rootDir, "reports/quality");
await mkdir(outDir, { recursive: true });
const jsonPath = join(outDir, `quality-audit-${stamp}.json`);
const mdPath = join(outDir, `quality-audit-${stamp}.md`);
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(mdPath, renderMarkdown(report.rows));

console.log(`QUALITY PASS ${report.pass}/${report.total} WARN ${report.warn} FAIL ${report.fail}`);
console.log(mdPath);
console.log(jsonPath);
if (report.fail > 0) process.exitCode = 1;

async function loadTopics(): Promise<readonly Topic[]> {
  const source = await readFile(join(rootDir, "packages/web/app/app/new/topic/data.ts"), "utf8");
  const pattern = /\{\s*grade:\s*(1|2|3),\s*category:\s*"([^"]+)",\s*code:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*achievement:\s*"([^"]+)",\s*\}/gms;
  const loaded = Array.from(source.matchAll(pattern)).map((match) => ({
    grade: Number.parseInt(match[1] ?? "1", 10) as Grade,
    category: match[2] ?? "",
    code: match[3] ?? "",
    name: match[4] ?? "",
    achievement: (match[5] ?? "").replace(/\s+/g, " ").trim(),
  }));
  if (loaded.length !== 30) throw new Error(`Expected 30 topics, found ${loaded.length}`);
  return loaded;
}

function audit(topic: Topic, mode: Mode): AuditRow {
  const request = requestFor(topic, mode);
  const candidate = deterministicInitialCandidate({
    request,
    intent: intentFor(topic),
    refs: [refFor(topic)],
    attempt: 1,
  });

  if (candidate === null) {
    return fail(topic, mode, "", "", ["no deterministic candidate"]);
  }

  const reasons = [
    ...commonQualityIssues(topic, candidate.question_text, candidate.expected_answer),
    ...modeQualityIssues(mode, candidate.question_text, candidate.proposed_solution_trace),
  ];
  const status = reasons.some((reason) => reason.startsWith("FAIL:"))
    ? "FAIL"
    : reasons.length > 0
      ? "WARN"
      : "PASS";

  return {
    grade: topic.grade,
    code: topic.code,
    name: topic.name,
    mode,
    status,
    question: candidate.question_text,
    answer: candidate.expected_answer,
    reasons,
  };
}

function requestFor(topic: Topic, mode: Mode): GenerateRequest {
  return {
    grade: topic.grade,
    topic: topic.code,
    topic_name: topic.name,
    mode,
    school_level: "middle",
    dims: ["A", "C"],
    count: 5,
    difficulty: "medium",
    problem_type: "objective",
    source_problem_text: topic.achievement,
  };
}

function intentFor(topic: Topic): Intent {
  return {
    objective_code: topic.code,
    objective_description: topic.name,
    evaluation_dimensions: [{ id: "A", description: topic.achievement, must_preserve: true }],
    required_techniques: [],
    forbidden_techniques: [],
    surface_constraints: { difficulty: "medium", problem_type: "objective" },
  };
}

function refFor(topic: Topic): RagResult {
  return {
    item_id: `${topic.code}:audit-ref`,
    match_reason: "hybrid",
    problem: {
      item_id: `${topic.code}:audit-ref`,
      source_dataset: "audit",
      split: "train",
      source_label_type: "problem_label",
      school_level: "middle",
      grade: topic.grade,
      semester: null,
      topic_code: topic.code,
      topic_name: topic.name,
      achievement_standard: topic.achievement,
      question_text: topic.achievement,
      answer_text: "",
      explanation_text: null,
      choice_blocks: [],
      problem_type_norm: "objective",
      difficulty_norm: "medium",
      question_image_relpath: null,
      answer_image_relpath: null,
      question_json_relpath: null,
      answer_json_relpath: null,
    },
  };
}

function commonQualityIssues(topic: Topic, question: string, answer: string): readonly string[] {
  const issues: string[] = [];
  if (question.trim().length < 12) issues.push("FAIL: question too short");
  if (answer.trim().length === 0) issues.push("FAIL: empty answer");
  if (question.includes("angle ")) issues.push("WARN: English angle notation remains");
  if (sameNormalized(question, topic.achievement)) issues.push("FAIL: copied achievement text");
  if (!topicEvidence(topic).some((token) => question.includes(token) || answer.includes(token))) {
    issues.push("WARN: weak topic evidence");
  }
  return issues;
}

function modeQualityIssues(mode: Mode, question: string, trace: string): readonly string[] {
  if (mode === "structural") {
    return trace.includes("구조동형") ? [] : ["FAIL: structural trace missing"];
  }

  const issues: string[] = [];
  if (!trace.includes("개념동형")) issues.push("FAIL: conceptual trace missing");
  if (!conceptualSignals(question, trace).some(Boolean)) {
    issues.push("WARN: conceptual transformation signal is weak");
  }
  return issues;
}

function conceptualSignals(question: string, trace: string): readonly boolean[] {
  const text = `${question}\n${trace}`;
  return [
    /어떤 수|공책|사과|배|택시|기온|직사각형|정사각형|주사위|복사|두 양수|두 수|합이|곱이/u.test(text),
    /원래의|결과가|소인수분해가|가능한|가까운|절댓값|더 큰 수|변화량|꼭짓점|중앙값|밑면|밑각|세 점|선분/u.test(text),
    /sin|닮음비|상대도수가|기약분수|sqrt\(|양의 제곱근|전개|평행사변형|x(?:\*\*2|\^2) - 2(?:\*?x|x) - 8|두 점/u.test(text),
  ];
}

function topicEvidence(topic: Topic): readonly string[] {
  const aliases = topicEvidenceAliases[topic.code] ?? [];
  const nameTokens = topic.name
    .split(/과|와|의|와 |과 | /u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  return [...aliases, ...nameTokens];
}

function fail(topic: Topic, mode: Mode, question: string, answer: string, reasons: readonly string[]): AuditRow {
  return { grade: topic.grade, code: topic.code, name: topic.name, mode, status: "FAIL", question, answer, reasons };
}

function sameNormalized(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

function normalize(value: string): string {
  return value.replace(/\s+/g, "").replace(/[.。]/g, "");
}

function renderMarkdown(rows: readonly AuditRow[]): string {
  const lines = [
    "# OpenMath Quality Audit",
    "",
    "| Grade | Code | Topic | Mode | Status | Reasons | Question | Answer |",
    "|---:|---|---|---|---|---|---|---|",
  ];
  for (const row of rows) {
    lines.push(`| ${row.grade} | ${row.code} | ${escapeMd(row.name)} | ${row.mode} | ${row.status} | ${escapeMd(row.reasons.join("; "))} | ${escapeMd(row.question)} | ${escapeMd(row.answer)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function escapeMd(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ").slice(0, 240);
}
