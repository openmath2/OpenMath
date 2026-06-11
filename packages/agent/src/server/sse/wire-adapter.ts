/**
 * Domain ProgressEvent -> frontend SSE wire payload adapter.
 *
 * Keeps the internal BE domain model stable while matching the existing FE hook
 * contract in `packages/web/hooks/use-verification-stream.ts`.
 *
 * step 이벤트의 `summary`는 게이트 evidence에서 추린 단계별 한 줄 서사다.
 * 실패는 `code: message` 원문을 그대로 노출하고 (D-11 투명성), 성공은
 * "무슨 일이 있었는지"를 한국어로 요약한다. evidence 필드가 없으면 조용히
 * 생략한다 — summary는 항상 best-effort.
 */

import { formatLatex } from "../../tools/latex-formatter.js";
import type {
  GateResult,
  GeneratedProblem,
  ProgressEvent,
  ResultEvent,
  StepEvent,
  StepName,
  Verification,
  WireErrorEvent,
  WireGate,
  WireResultEvent,
  WireResultProblem,
  WireSseEvent,
  WireStepEvent,
  WireStepIndex,
  WireStepStatus,
} from "../../schemas/index.js";

const STEP_META: Record<StepName, { index: WireStepIndex; name: string }> = {
  rag: { index: 1, name: "RAG 검색" },
  intent: { index: 2, name: "의도 추출" },
  generate: { index: 3, name: "문제 생성" },
  sympy_verify: { index: 4, name: "산술 검증 (SymPy)" },
  re_solve: { index: 5, name: "독립 재풀이" },
  objective_map: { index: 6, name: "학습 목표 매핑" },
};

function mapStepStatus(event: StepEvent): WireStepStatus {
  if (event.status === "start") return "started";
  if (event.status === "info") return "failed";
  const gateStatus = readGateStatus(event.data);
  if (gateStatus === "failed") return "failed";
  if (gateStatus === "unverified") return "unverified";
  return "completed";
}

export function toWireStepEvent(event: StepEvent): WireStepEvent {
  const meta = STEP_META[event.step];
  const status = mapStepStatus(event);
  return {
    index: meta.index,
    name: meta.name,
    status,
    summary: stepSummary(event, status),
  };
}

function stepSummary(event: StepEvent, status: WireStepStatus): string | null {
  if (status === "started") return null;
  const failure = readGateFailureSummary(event.data);
  if (status === "failed" && failure !== null) return failure;
  const gate = readGate(event.data);
  if (gate === null) return failure;
  const narrative = successSummary(event.step, gate);
  if (narrative === null) return failure;
  return withDuration(narrative, gate);
}

/** 게이트 evidence → 단계별 성공/판정불가 서사. evidence 계약이 어긋나면 null. */
function successSummary(step: StepName, gate: Record<string, unknown>): string | null {
  const evidence = asRecord(gate["evidence"]) ?? {};
  if (step === "rag") return ragSummary(evidence);
  if (step === "intent") return intentSummary(evidence);
  if (step === "generate") return generateSummary(evidence);
  if (step === "sympy_verify") return sympySummary(gate, evidence);
  if (step === "re_solve") return reSolveSummary(evidence);
  return objectiveSummary(evidence);
}

function ragSummary(evidence: Record<string, unknown>): string | null {
  const refs = asNumber(evidence["refs"]);
  if (refs === null) return null;
  return `참조 ${refs}문항 확보`;
}

function intentSummary(evidence: Record<string, unknown>): string | null {
  const code = asString(evidence["objective_code"]);
  if (code === null) return null;
  const dimensions = asNumber(evidence["dimensions"]);
  const base = dimensions === null ? `목표 ${code}` : `목표 ${code} · 평가차원 ${dimensions}개`;
  if (evidence["fallback"] === true) {
    return `${base} (LLM 응답 실패 — 시드 의도로 대체)`;
  }
  return base;
}

function generateSummary(evidence: Record<string, unknown>): string | null {
  const refinedBy = asStringArray(evidence["refined_by"]) ?? [];
  if (refinedBy.includes("deterministic-topic-generator")) {
    return "결정론 템플릿 후보 사용";
  }
  const model = asString(evidence["model"]);
  if (model === null) return null;
  const criticRounds = refinedBy.filter((name) => name === "constraint-critic").length;
  const refinerRuns = refinedBy.filter((name) => name === "refiner").length;
  const parts = [`후보 생성 (${model})`];
  if (criticRounds > 0) parts.push(`Critic ${criticRounds}라운드`);
  if (refinerRuns > 0) parts.push(`수정 ${refinerRuns}회`);
  const hints = asNumber(evidence["critic_hints_total"]);
  if (hints !== null && hints > 0) parts.push(`지적 ${hints}건 반영`);
  return parts.join(" · ");
}

function sympySummary(
  gate: Record<string, unknown>,
  evidence: Record<string, unknown>,
): string | null {
  if (gate["status"] === "unverified") {
    const kind = asString(evidence["verification_kind"]);
    const kindLabel = kind === null || kind === "equation" ? "" : ` (${kind} 유형)`;
    return `기호 검증 불가${kindLabel} — 독립 재풀이로 확인`;
  }
  const sympyAnswer = asString(evidence["sympy_answer"]);
  if (evidence["symbolic_check"] === true) {
    return "검증식 기호 동치 확인";
  }
  if (evidence["expression_check"] === true) {
    return sympyAnswer === null ? "검증식 평가 일치" : `검증식 평가 일치 (값: ${sympyAnswer})`;
  }
  if (sympyAnswer === null) return "SymPy 검산 일치";
  return `SymPy 검산 일치 (해: ${sympyAnswer})`;
}

function reSolveSummary(evidence: Record<string, unknown>): string | null {
  const derived = asString(evidence["derived_answer"]);
  if (derived === null) return null;
  const confidence = asString(evidence["confidence"]);
  const confidenceLabel =
    confidence === "high" ? "높음" : confidence === "medium" ? "중간" : confidence === "low" ? "낮음" : null;
  return confidenceLabel === null
    ? `재풀이 일치 (${derived})`
    : `재풀이 일치 (${derived} · 확신도 ${confidenceLabel})`;
}

function objectiveSummary(evidence: Record<string, unknown>): string | null {
  const used = asStringArray(evidence["techniques_used"]);
  const overlapping = asStringArray(evidence["overlapping_techniques"]);
  if (used === null) return "학습 목표 일치";
  if (overlapping !== null && overlapping.length > 0) {
    return `학습 목표 일치 · 기법 ${overlapping.length}개 확인`;
  }
  return `학습 목표 일치 · 사용 기법 ${used.length}개`;
}

function withDuration(summary: string, gate: Record<string, unknown>): string {
  const durationMs = asNumber(gate["duration_ms"]);
  if (durationMs === null || durationMs < 100) return summary;
  return `${summary} · ${(durationMs / 1000).toFixed(1)}초`;
}

function readGateStatus(data: unknown): "passed" | "failed" | "skipped" | "unverified" | null {
  const gate = readGate(data);
  if (gate === null) return null;
  const status = gate["status"];
  if (status === "passed" || status === "failed" || status === "skipped" || status === "unverified") {
    return status;
  }
  return null;
}

function readGateFailureSummary(data: unknown): string | null {
  const gate = readGate(data);
  if (gate === null) return null;
  const detail = asRecord(gate["failure_detail"]);
  if (detail === null) return null;
  const code = detail["code"];
  const message = detail["message"];
  if (typeof code !== "string" || typeof message !== "string") return null;
  return `${code}: ${message}`;
}

function readGate(data: unknown): Record<string, unknown> | null {
  const outer = asRecord(data);
  if (outer === null) return null;
  return asRecord(outer["gate"]);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const entries: Array<[string, unknown]> = Object.entries(value);
  return Object.fromEntries(entries);
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

function mapVerificationStatus(
  overall: Verification["overall"],
): WireResultProblem["verification_status"] {
  if (overall === "verified") return "pass";
  if (overall === "warning") return "partial";
  return "fail";
}

function preservedDimensions(problem: GeneratedProblem): string[] {
  return problem.inferred_intent.evaluation_dimensions
    .filter((dimension) => dimension.must_preserve)
    .map((dimension) => dimension.description);
}

function toWireGate(gate: GateResult): WireGate {
  const wire: WireGate = {
    step: gate.step,
    status: gate.status,
    duration_ms: gate.duration_ms,
  };
  if (gate.failure_detail !== undefined) {
    wire.failure_code = gate.failure_detail.code;
    wire.failure_message = gate.failure_detail.message;
  }
  return wire;
}

export function toWireResultProblem(
  problem: GeneratedProblem,
  verification: Verification,
): WireResultProblem {
  const solution = problem.proposed_solution_trace.trim();
  return {
    id: problem.candidate_id,
    question_latex: problem.question_text,
    answer_latex: problem.expected_answer,
    // 풀이 trace 는 sympy 표기 그대로 오므로 표현 경계에서 LaTeX 로 변환
    ...(solution.length === 0 ? {} : { explanation_latex: formatLatex(solution) }),
    isomorphism: problem.mode,
    preserved_dimensions: preservedDimensions(problem),
    source_refs: problem.source_refs,
    verification_status: mapVerificationStatus(verification.overall),
    overall: verification.overall,
    gates: verification.gates.map(toWireGate),
    attempt_count: verification.attempt_count,
    generation_model: problem.generation_metadata.model,
    refined_by: problem.generation_metadata.refined_by ?? [],
  };
}

export function toWireResultEvent(event: ResultEvent): WireResultEvent {
  return event.candidates.map(({ problem, verification }) =>
    toWireResultProblem(problem, verification),
  );
}

function toWireErrorEvent(event: Extract<ProgressEvent, { type: "error" }>): WireErrorEvent {
  return {
    stage: event.stage,
    message: publicErrorMessage(event),
  };
}

/** 내부 메시지는 노출하지 않되, 알려진 실패 코드는 사용자가 행동할 수 있는 문구로 변환. */
function publicErrorMessage(event: Extract<ProgressEvent, { type: "error" }>): string {
  if (event.code === "no_refs") {
    return "선택한 단원에서 참조 문항을 찾지 못했습니다. 다른 단원이나 기준 문항으로 시도해 주세요.";
  }
  if (event.code === "generation_failed" || event.code === "all_generations_failed") {
    return "문제 생성에 반복 실패했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (event.recoverable) {
    return "검증 중 복구 가능한 오류가 발생했습니다. 다시 시도합니다.";
  }
  return "검증 파이프라인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

export function toWireSseEvent(event: ProgressEvent): WireSseEvent {
  switch (event.type) {
    case "step":
      return { event: "step", data: toWireStepEvent(event) };
    case "retry":
      return {
        event: "attempt",
        data: {
          attempt: event.attempt,
          max_attempts: event.max_attempts,
          reason: event.reason,
        },
      };
    case "preview":
      return { event: "preview", data: { latex: event.latex } };
    case "result":
      return { event: "result", data: toWireResultEvent(event) };
    case "error":
      return { event: "error", data: toWireErrorEvent(event) };
  }
}
