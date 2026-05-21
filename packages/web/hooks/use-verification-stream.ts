"use client";

import {
  fetchEventSource,
  type EventSourceMessage,
} from "@microsoft/fetch-event-source";
import { useEffect, useReducer, useRef } from "react";

/* ─────────────────────────────────────────────────────────────
 * SSE 컨트랙트 (packages/web/README.md §"SSE Consumption" + D-6)
 *   event: "step"    — { index: 1..6, name: string, status: "started" | "completed" | "failed", summary?: string }
 *   event: "preview" — { latex: string }   ← 3/6 완료 후 첫 후보 미리보기 (확장)
 *   event: "result"  — GeneratedProblem[]  ← 통과한 문항 묶음 (최종)
 *   event: "error"   — { stage: string, message: string }
 *
 * 본 hook 은 @openmath/agent 스키마가 워크스페이스 dep 으로 추가되기 전까지
 * 로컬 타입을 사용한다. 추후 zod 스키마 import 로 검증을 강화한다.
 * ──────────────────────────────────────────────────────────── */

export const STEP_NAMES: readonly string[] = [
  "RAG 검색",
  "의도 추출",
  "문제 생성",
  "산술 검증 (SymPy)",
  "독립 재풀이",
  "학습 목표 매핑",
] as const;

export type StepStatus = "pending" | "active" | "pass" | "fail";

export type Step = {
  index: number;
  name: string;
  status: StepStatus;
  summary: string | null;
};

export type GeneratedProblem = {
  id: string;
  question_latex: string;
  answer_latex: string;
  explanation_latex?: string;
  isomorphism: "structural" | "conceptual";
  preserved_dimensions: string[];
  verification_status: "pass" | "partial" | "fail";
};

export type StreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "done"
  | "cancelled"
  | "error";

export type StreamState = {
  steps: Step[];
  status: StreamStatus;
  previewLatex: string | null;
  candidates: GeneratedProblem[];
  error: string | null;
};

export type StreamInput = {
  grade: 1 | 2 | 3;
  topic: string;
  mode: "structural" | "conceptual";
  dims: readonly string[];
  /** override agent endpoint. defaults to NEXT_PUBLIC_AGENT_URL or localhost:3000 */
  endpoint?: string;
};

function makeInitialState(): StreamState {
  return {
    steps: STEP_NAMES.map((name, i) => ({
      index: i + 1,
      name,
      status: "pending" as const,
      summary: null,
    })),
    status: "idle",
    previewLatex: null,
    candidates: [],
    error: null,
  };
}

type Action =
  | { type: "CONNECTING" }
  | {
      type: "STEP";
      index: number;
      status: "started" | "completed" | "failed";
      summary: string | null;
    }
  | { type: "PREVIEW"; latex: string }
  | { type: "RESULT"; candidates: GeneratedProblem[] }
  | { type: "ERROR"; message: string }
  | { type: "CANCELLED" }
  | { type: "CLOSED" };

type WireStepStatus = "started" | "completed" | "failed";

function mapStepStatus(s: WireStepStatus): StepStatus {
  if (s === "started") return "active";
  if (s === "completed") return "pass";
  return "fail";
}

function reducer(state: StreamState, action: Action): StreamState {
  switch (action.type) {
    case "CONNECTING":
      /* 새 stream 시작 시 이전 run 의 step / preview / candidates / error 가
       * leak 되지 않게 initial state 로 reset 후 status 만 connecting 으로.
       */
      return { ...makeInitialState(), status: "connecting" };
    case "STEP": {
      const nextStatus = mapStepStatus(action.status);
      const steps = state.steps.map((s) =>
        s.index === action.index
          ? { ...s, status: nextStatus, summary: action.summary }
          : s,
      );
      return { ...state, status: "streaming", steps };
    }
    case "PREVIEW":
      return { ...state, previewLatex: action.latex };
    case "RESULT":
      return { ...state, candidates: action.candidates, status: "done" };
    case "ERROR":
      return { ...state, status: "error", error: action.message };
    case "CANCELLED":
      return { ...state, status: "cancelled" };
    case "CLOSED":
      return state.status === "streaming"
        ? { ...state, status: "done" }
        : state;
  }
}

/* ───── payload narrowing — JSON 안에서 안전하게 필드 꺼내기 ───── */

function asObject(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function parseStep(raw: unknown): {
  index: number;
  status: "started" | "completed" | "failed";
  summary: string | null;
} | null {
  const o = asObject(raw);
  if (o === null) return null;
  const index = asNumber(o.index);
  const status = asString(o.status);
  if (index === null || index < 1 || index > 6) return null;
  if (status !== "started" && status !== "completed" && status !== "failed") {
    return null;
  }
  return {
    index,
    status,
    summary: asString(o.summary),
  };
}

function parsePreview(raw: unknown): string | null {
  const o = asObject(raw);
  if (o === null) return null;
  return asString(o.latex);
}

function parseProblem(raw: unknown): GeneratedProblem | null {
  const o = asObject(raw);
  if (o === null) return null;
  const id = asString(o.id);
  const question = asString(o.question_latex);
  const answer = asString(o.answer_latex);
  const iso = asString(o.isomorphism);
  const verif = asString(o.verification_status);
  if (id === null || question === null || answer === null) return null;
  if (iso !== "structural" && iso !== "conceptual") return null;
  if (verif !== "pass" && verif !== "partial" && verif !== "fail") return null;
  const dims = Array.isArray(o.preserved_dimensions)
    ? o.preserved_dimensions.filter((d): d is string => typeof d === "string")
    : [];
  const explanation = asString(o.explanation_latex);
  return {
    id,
    question_latex: question,
    answer_latex: answer,
    explanation_latex: explanation ?? undefined,
    isomorphism: iso,
    preserved_dimensions: dims,
    verification_status: verif,
  };
}

function parseResult(raw: unknown): GeneratedProblem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: GeneratedProblem[] = [];
  for (const item of raw) {
    const p = parseProblem(item);
    if (p === null) return null;
    out.push(p);
  }
  return out;
}

function parseError(raw: unknown): { stage: string; message: string } | null {
  const o = asObject(raw);
  if (o === null) return null;
  const stage = asString(o.stage) ?? "unknown";
  const message = asString(o.message) ?? "알 수 없는 오류";
  return { stage, message };
}

/* ───── 사용자 액션이 발생할 때까지 retry 를 막는 시그널 ─────
 * fetch-event-source 는 onerror 에서 throw 하지 않으면 retry 한다.
 * 의도하지 않은 retry 로 서버에 중복 요청이 발생하지 않게 명시적으로 차단.
 */
class FatalStreamError extends Error {}

/* ───── 기본 endpoint ───── */
function defaultEndpoint(): string {
  const env =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_AGENT_URL : undefined;
  return env ?? "http://localhost:3000";
}

export type UseVerificationStreamResult = StreamState & {
  cancel: () => void;
};

export function useVerificationStream(
  input: StreamInput | null,
): UseVerificationStreamResult {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
  const controllerRef = useRef<AbortController | null>(null);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  /* input 의 dims 배열 동일성 비교를 위해 안정 키 생성.
   * inputKey 는 input 의 모든 의미상 식별자를 직렬화하므로 effect deps 로 충분.
   */
  const dimsKey = input === null ? "" : [...input.dims].sort().join(",");
  const inputKey =
    input === null
      ? null
      : `${input.grade}|${input.topic}|${input.mode}|${dimsKey}|${input.endpoint ?? ""}`;

  /* effect 본문이 input 의 *최신* 값을 읽어야 하지만 deps 로 넣으면 가드가
   * 무효화되어 부모 re-render 마다 SSE 재연결이 발생한다 (PR #7 리뷰).
   * ref 로 snapshot 을 항상 최신으로 유지하고 effect 진입 시점에서 한 번 읽는다.
   */
  const inputRef = useRef<StreamInput | null>(input);
  inputRef.current = input;

  useEffect(() => {
    if (inputKey === null) {
      return;
    }
    const current = inputRef.current;
    if (current === null) {
      return;
    }

    /* React 18 strict-mode 더블 마운트 방어:
     * 이전 mount 의 controller 가 살아 있으면 abort. 새 controller 로 다시 시작.
     */
    if (controllerRef.current !== null) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    const endpoint = current.endpoint ?? defaultEndpoint();
    const url = `${endpoint.replace(/\/$/, "")}/api/generate`;

    dispatchRef.current({ type: "CONNECTING" });

    void fetchEventSource(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        grade: current.grade,
        topic: current.topic,
        mode: current.mode,
        dims: [...current.dims].sort(),
      }),
      signal: controller.signal,
      openWhenHidden: true,

      onopen: async (res) => {
        if (
          res.ok &&
          (res.headers.get("content-type") ?? "").includes("text/event-stream")
        ) {
          return;
        }
        throw new FatalStreamError(
          `서버 응답 오류 (${res.status}): ${res.statusText}`,
        );
      },

      onmessage: (ev: EventSourceMessage) => {
        if (!ev.data) return;
        let payload: unknown;
        try {
          payload = JSON.parse(ev.data);
        } catch {
          dispatchRef.current({
            type: "ERROR",
            message: `잘못된 이벤트 페이로드 (${ev.event ?? "message"})`,
          });
          throw new FatalStreamError("invalid JSON");
        }

        switch (ev.event) {
          case "step": {
            const step = parseStep(payload);
            if (step === null) {
              dispatchRef.current({
                type: "ERROR",
                message: "step 이벤트 형식 오류",
              });
              throw new FatalStreamError("bad step");
            }
            dispatchRef.current({ type: "STEP", ...step });
            break;
          }
          case "preview": {
            const latex = parsePreview(payload);
            if (latex !== null) {
              dispatchRef.current({ type: "PREVIEW", latex });
            }
            break;
          }
          case "result": {
            const candidates = parseResult(payload);
            if (candidates === null) {
              dispatchRef.current({
                type: "ERROR",
                message: "result 이벤트 형식 오류",
              });
              throw new FatalStreamError("bad result");
            }
            dispatchRef.current({ type: "RESULT", candidates });
            controller.abort();
            break;
          }
          case "error": {
            const parsed = parseError(payload);
            const msg = parsed?.message ?? "검증 파이프라인 오류";
            dispatchRef.current({ type: "ERROR", message: msg });
            throw new FatalStreamError(msg);
          }
        }
      },

      onerror: (err) => {
        /* throw 하면 fetch-event-source 가 retry 를 중단한다.
         * abort 된 경우는 사용자가 cancel 한 것이므로 throw 만 한다.
         */
        if (controller.signal.aborted) {
          throw err instanceof Error ? err : new Error("aborted");
        }
        const message =
          err instanceof FatalStreamError
            ? err.message
            : err instanceof Error
              ? err.message
              : "연결이 끊겼습니다";
        dispatchRef.current({ type: "ERROR", message });
        throw err instanceof Error ? err : new Error(message);
      },

      onclose: () => {
        dispatchRef.current({ type: "CLOSED" });
      },
    }).catch(() => {
      /* onerror 에서 던진 예외는 여기로 흡수. state 는 이미 dispatch 됨. */
    });

    return () => {
      controller.abort();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [inputKey]);

  /* cancel 은 hook 의 외부 API. 사용자가 "취소" 버튼을 눌렀을 때 호출. */
  const cancel = (): void => {
    if (controllerRef.current !== null) {
      controllerRef.current.abort();
      controllerRef.current = null;
      dispatchRef.current({ type: "CANCELLED" });
    }
  };

  return { ...state, cancel };
}
