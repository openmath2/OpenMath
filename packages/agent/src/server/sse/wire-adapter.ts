/**
 * Domain ProgressEvent -> frontend SSE wire payload adapter.
 *
 * Keeps the internal BE domain model stable while matching the existing FE hook
 * contract in `packages/web/hooks/use-verification-stream.ts`.
 */

import type {
  GeneratedProblem,
  ProgressEvent,
  ResultEvent,
  StepEvent,
  StepName,
  Verification,
  WireErrorEvent,
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
  return "completed";
}

export function toWireStepEvent(event: StepEvent): WireStepEvent {
  const meta = STEP_META[event.step];
  return {
    index: meta.index,
    name: meta.name,
    status: mapStepStatus(event),
    summary: null,
  };
}

function readGateStatus(data: unknown): "passed" | "failed" | "skipped" | null {
  if (typeof data !== "object" || data === null || !("gate" in data)) return null;
  const gate = data.gate;
  if (typeof gate !== "object" || gate === null || !("status" in gate)) return null;
  const status = gate.status;
  if (status === "passed" || status === "failed" || status === "skipped") return status;
  return null;
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

export function toWireResultProblem(
  problem: GeneratedProblem,
  verification: Verification,
): WireResultProblem {
  return {
    id: problem.candidate_id,
    question_latex: problem.question_text,
    answer_latex: problem.expected_answer,
    isomorphism: problem.mode,
    preserved_dimensions: preservedDimensions(problem),
    verification_status: mapVerificationStatus(verification.overall),
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

function retryToWireStep(event: Extract<ProgressEvent, { type: "retry" }>): WireStepEvent {
  return {
    ...STEP_META.generate,
    status: "started",
    summary: `재시도 ${event.attempt}`,
  };
}

function publicErrorMessage(event: Extract<ProgressEvent, { type: "error" }>): string {
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
      return { event: "step", data: retryToWireStep(event) };
    case "result":
      return { event: "result", data: toWireResultEvent(event) };
    case "error":
      return { event: "error", data: toWireErrorEvent(event) };
  }
}
