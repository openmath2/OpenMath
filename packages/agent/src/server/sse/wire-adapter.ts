/**
 * Wire adapter — agent 내부 ProgressEvent 를 FE 가 받는 SSE wire format 으로 매핑.
 *
 * 두 가지 책임:
 *  1. `mapStepStatus`: 내부 step status enum ("start"/"done"/"info") → wire enum
 *     ("started"/"completed"/"failed") 변환
 *  2. `toWireSseEvent`: ProgressEvent 전체를 { event, data } SSE 페이로드로 직렬화
 *     (progress-stream.ts: pipeProgressToSse 가 이걸 호출해 SSEStreamingApi 에 write)
 *
 * 입력 (agent 내부, StepStatusSchema): "start" | "done" | "info"
 * 출력 (FE wire, packages/web/hooks/use-verification-stream.ts: WireStepStatus): "started" | "completed" | "failed"
 *
 * "info" 는 진행 도중 보조 정보 신호이며, FE 의 step bar 가 명확히 처리할 수 없으므로
 * "failed" 로 안전하게 강등 (silent drop 보다 가시화). 정의되지 않은 값도 동일하게 "failed".
 */

import type {
  ProgressEvent,
  StepStatus,
} from "../../schemas/progress-event.schema.js";
import type { StepName } from "../../schemas/verification.schema.js";

export type WireStepStatus = "started" | "completed" | "failed";

export function mapStepStatus(status: StepStatus): WireStepStatus {
  if (status === "start") return "started";
  if (status === "done") return "completed";
  if (status === "info") return "failed";
  return "failed";
}

/* StepName → 사용자 가시 1..6 인덱스. FE step bar 의 6 단계 ▌ 인디케이터 순서와 일치.
 * (user 가 언급한 "STEP_META Record" 의 핵심 역할 = step 이름 → index 변환)
 */
const STEP_INDEX: Record<StepName, number> = {
  rag: 1,
  intent: 2,
  generate: 3,
  sympy_verify: 4,
  re_solve: 5,
  objective_map: 6,
};

export interface WireSseEvent {
  /** SSE `event:` field. EventSource 의 `addEventListener(this, ...)` 가 받음. */
  event: string;
  /** SSE `data:` field. JSON 직렬화된 string. FE 가 JSON.parse 후 narrowing. */
  data: string;
}

/* OM-78: StepEvent.data 가 unknown 이라 runtime 에서 narrowing 필요.
 * `as any` 없이 typeof / Array.isArray 가드 후 Record<string, unknown> 으로만 캐스팅.
 */
function asObject(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function arrayLen(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  return Array.isArray(v) ? v.length : 0;
}
function boolField(obj: Record<string, unknown>, key: string): boolean {
  return obj[key] === true;
}
function numberField(obj: Record<string, unknown>, key: string): number {
  const n = obj[key];
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}
function stringField(obj: Record<string, unknown>, key: string): string | null {
  const s = obj[key];
  return typeof s === "string" ? s : null;
}
function stringArrayField(obj: Record<string, unknown>, key: string): string[] {
  const v = obj[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/**
 * OM-78: StepEvent.data 에서 step 별 한국어 요약 텍스트 생성.
 *
 * 본 함수는 workflow (T-022 구현 시) 가 각 step 의 `done` 이벤트에 attach 할 data 의
 * 계약을 정의한다. 계약대로 data 가 안 오면 (또는 data === undefined) `null` 반환,
 * FE 가 summary 없는 step 으로 렌더.
 *
 * 계약:
 *  - rag           : `{ refs: SourceProblem[] }` 또는 `{ results: SourceProblem[] }` — 참조 수
 *  - intent        : `{ evaluation_dimensions: EvaluationDimension[] }`
 *  - generate      : `{ critic_rounds: number }`
 *  - sympy_verify  : `{ passed: boolean }`
 *  - re_solve      : `{ status: "passed" | "failed" | "skipped" }`
 *  - objective_map : `{ passed: boolean, preserved_dims: string[] }`
 */
export function makeStepSummary(step: StepName, data: unknown): string | null {
  const obj = asObject(data);
  if (obj === null) return null;

  switch (step) {
    case "rag": {
      /* RAGSpecialist 가 attach 할 키: refs (canonical) 또는 results (별칭). */
      const n = arrayLen(obj, "refs") || arrayLen(obj, "results");
      return n > 0 ? `${n}개 참조 발견` : null;
    }
    case "intent": {
      const n = arrayLen(obj, "evaluation_dimensions");
      return n > 0 ? `학습 목표 · 평가 차원 ${n}개` : null;
    }
    case "generate": {
      const rounds = numberField(obj, "critic_rounds");
      return `후보 1개 (생성 1회 + critic ${rounds}회)`;
    }
    case "sympy_verify": {
      return boolField(obj, "passed")
        ? "passed — 답 일치"
        : "failed — 답 불일치";
    }
    case "re_solve": {
      const status = stringField(obj, "status");
      if (status === "skipped") return "skipped — Solver 재풀이 생략";
      if (status === "passed") return "passed — Solver 재풀이 일치";
      if (status === "failed") return "failed — Solver 재풀이 불일치";
      return null;
    }
    case "objective_map": {
      const passed = boolField(obj, "passed");
      const preserved = stringArrayField(obj, "preserved_dims");
      if (!passed) return "failed — 목표 불일치";
      return preserved.length > 0
        ? `passed — ${preserved.join("·")} 보존`
        : "passed";
    }
  }
}

/**
 * ProgressEvent (agent 내부) → WireSseEvent (FE 가 받는 페이로드) 변환.
 *
 * 매핑 정책:
 * - step: name → index 변환 + status enum 변환 → { index, name, status }
 * - preview: latex 만 전달 → { latex } (FE parsePreview 와 1:1 매칭)
 * - retry: attempt/reason 전달
 * - result: candidates 배열 (현재는 agent 의 GeneratedProblem 원본 — FE 의 parseProblem 이
 *   기대하는 필드 rename 매핑은 향후 통합 PR 에서 정의. 본 OM-79 scope 밖)
 * - error: stage/message 전달 (code/recoverable 은 FE 가 안 읽으므로 drop)
 */
export function toWireSseEvent(event: ProgressEvent): WireSseEvent {
  switch (event.type) {
    case "step":
      /* OM-78: summary 는 StepEvent.data 에서 step 별로 계약된 필드를 narrowing 해
       *  한국어 문장으로 변환. data 가 없거나 계약 위반이면 makeStepSummary 가 null 반환
       *  → FE 의 step bar 가 summary 없는 행으로 렌더 (기존 동작과 호환). */
      return {
        event: "step",
        data: JSON.stringify({
          index: STEP_INDEX[event.step],
          name: event.step,
          status: mapStepStatus(event.status),
          summary: makeStepSummary(event.step, event.data),
        }),
      };
    case "preview":
      /* OM-79: FE parsePreview 가 { latex: string } 만 읽음. timestamp 등은 drop. */
      return {
        event: "preview",
        data: JSON.stringify({ latex: event.latex }),
      };
    case "retry":
      return {
        event: "retry",
        data: JSON.stringify({
          attempt: event.attempt,
          reason: event.reason,
        }),
      };
    case "result":
      return {
        event: "result",
        data: JSON.stringify(event.candidates),
      };
    case "error":
      return {
        event: "error",
        data: JSON.stringify({
          stage: event.stage,
          message: event.message,
        }),
      };
  }
}
