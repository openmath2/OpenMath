"use client";

import {
  fetchEventSource,
  type EventSourceMessage,
} from "@microsoft/fetch-event-source";
import { useEffect, useReducer, useRef } from "react";
import { verificationStorageKey } from "@/lib/verification-storage-key";

/* ─────────────────────────────────────────────────────────────
 * SSE 컨트랙트 (packages/web/README.md §"SSE Consumption" + D-6)
 *   event: "step"    — { index: 1..6, name: string,
 *                        status: "started" | "completed" | "failed" | "unverified",
 *                        summary?: string }
 *                       summary 는 성공 시에도 단계 서사("후보 생성 (gpt-5.5) · Critic 1라운드 · 3.2초")가 온다.
 *                       "unverified" = 결정론 검증 불가(실패 아님) — 독립 재풀이로만 확인됨.
 *   event: "preview" — { latex: string }   ← 3/6 완료 직후 후보 문제 미리보기
 *   event: "attempt" — { attempt, max_attempts, reason } ← 검증 실패로 재생성 시작. 3~6단계 리셋.
 *   event: "runs"    — { completed, total } ← 병렬 생성 런 집계 (count > 1)
 *   event: "result"  — GeneratedProblem[]  ← 통과한 문항 묶음 (최종)
 *   event: "error"   — { stage: string, message: string }
 *
 * 본 hook 은 @openmath/agent 스키마가 워크스페이스 dep 으로 추가되기 전까지
 * 로컬 타입을 사용한다. 추후 zod 스키마 import 로 검증을 강화한다.
 * ──────────────────────────────────────────────────────────── */

const STEP_NAMES: readonly string[] = [
  "비슷한 문제 찾기",
  "출제 의도 분석",
  "문제 생성",
  "산술 검증 (SymPy)",
  "독립 재풀이",
  "학습 목표 점검",
] as const;

export type StepStatus = "pending" | "active" | "pass" | "fail" | "unverified";

export type Step = {
  index: number;
  name: string;
  status: StepStatus;
  summary: string | null;
};

export type AttemptInfo = {
  current: number;
  max: number;
  reason: string | null;
};

export type RunsInfo = {
  completed: number;
  total: number;
};

export type GeneratedProblem = {
  id: string;
  question_latex: string;
  answer_latex: string;
  explanation_latex?: string;
  isomorphism: "structural" | "conceptual";
  preserved_dimensions: string[];
  verification_status: "pass" | "partial" | "fail";
  /* 출처(provenance) 시그널 — agent 측 결정론 템플릿이 LLM 대신 본 후보를 만들면
   * `"deterministic-topic-generator"` 가 들어온다 (i-1 remediation plan).
   * UI 는 이 값을 보고 "템플릿 폴백" badge 를 노출해 검증된 LLM 결과와 시각적으로 구분.
   * 기존 mock / stored data 호환을 위해 두 필드 모두 optional.
   */
  generation_model?: string;
  refined_by?: string[];
  /* 3-state 검증 게이트 모델 (task 2-6 remediation plan) — agent 는 각 step 의
   * gate status 를 `"passed" | "failed" | "skipped" | "unverified"` 4값으로 emit.
   * `unverified` 는 SymPy 기호 검증을 수행할 수 없었음을 뜻하며 ("기호 검증 불가"),
   * 독립 재풀이로만 확인됐다는 의미. UI 는 이 값으로 "기호 검증 불가" badge 를 노출.
   * 기존 mock / stored data 호환을 위해 모두 optional.
   */
  gates?: Array<{ step: string; status: string }>;
  overall?: string;
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
  /** 재생성 시도 정보 (시도 2/3 …). 첫 시도 중에는 null. */
  attempt: AttemptInfo | null;
  /** 병렬 생성 런 집계 (count > 1 일 때만 수신). */
  runs: RunsInfo | null;
};

export type StreamInput = {
  schoolLevel: "middle" | "high";
  grade: 1 | 2 | 3 | null;
  topic: string;
  topicName: string;
  mode: "structural" | "conceptual";
  sourceItemId: string;
  sourceProblemText?: string;
  /** "attached" 면 첨부 문제 플로우 — 생성기가 refs 보다 첨부 문제를 우선한다. 기본 corpus. */
  sourceOrigin?: "corpus" | "attached";
  /** 첨부 문제에서 추론한 generation kind. 있으면 토픽 파생값보다 우선. */
  generationKind?: string;
  /** override agent endpoint. defaults to NEXT_PUBLIC_AGENT_URL or localhost:31415 */
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
    attempt: null,
    runs: null,
  };
}

type Action =
  | { type: "CONNECTING" }
  | {
      type: "STEP";
      index: number;
      status: WireStepStatus;
      summary: string | null;
    }
  | { type: "PREVIEW"; latex: string }
  | { type: "ATTEMPT"; attempt: AttemptInfo }
  | { type: "RUNS"; runs: RunsInfo }
  | { type: "RESULT"; candidates: GeneratedProblem[] }
  | { type: "ERROR"; message: string }
  | { type: "CANCELLED" }
  | { type: "CLOSED" };

type WireStepStatus = "started" | "completed" | "failed" | "unverified";

function mapStepStatus(s: WireStepStatus): StepStatus {
  if (s === "started") return "active";
  if (s === "completed") return "pass";
  if (s === "unverified") return "unverified";
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
    case "ATTEMPT": {
      /* 재생성 시작 — 3~6단계는 이전 시도의 결과이므로 pending으로 리셋.
       * 1~2단계(RAG/의도)는 재사용되므로 유지. preview는 새 후보가 오면 교체된다. */
      const steps = state.steps.map((s) =>
        s.index >= 3 ? { ...s, status: "pending" as const, summary: null } : s,
      );
      return { ...state, steps, attempt: action.attempt };
    }
    case "RUNS":
      return { ...state, runs: action.runs };
    case "RESULT":
      return { ...state, candidates: action.candidates, status: "done" };
    case "ERROR":
      return { ...state, status: "error", error: action.message };
    case "CANCELLED":
      return { ...state, status: "cancelled" };
    case "CLOSED":
      return state.status === "streaming" && state.candidates.length === 0
        ? {
            ...state,
            status: "error",
            error: "검증 스트림이 결과 없이 종료되었습니다. 다시 시도해 주세요.",
          }
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
  status: WireStepStatus;
  summary: string | null;
} | null {
  const o = asObject(raw);
  if (o === null) return null;
  const index = asNumber(o.index);
  const status = asString(o.status);
  if (index === null || index < 1 || index > 6) return null;
  if (
    status !== "started" &&
    status !== "completed" &&
    status !== "failed" &&
    status !== "unverified"
  ) {
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

function parseAttempt(raw: unknown): AttemptInfo | null {
  const o = asObject(raw);
  if (o === null) return null;
  const current = asNumber(o.attempt);
  const max = asNumber(o.max_attempts);
  if (current === null || max === null) return null;
  return { current, max, reason: asString(o.reason) };
}

function parseRuns(raw: unknown): RunsInfo | null {
  const o = asObject(raw);
  if (o === null) return null;
  const completed = asNumber(o.completed);
  const total = asNumber(o.total);
  if (completed === null || total === null) return null;
  return { completed, total };
}

function parseGate(raw: unknown): { step: string; status: string } | null {
  const o = asObject(raw);
  if (o === null) return null;
  const step = asString(o.step);
  const status = asString(o.status);
  if (step === null || status === null) return null;
  return { step, status };
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
  const generationModel = asString(o.generation_model);
  const refinedBy = Array.isArray(o.refined_by)
    ? o.refined_by.filter((r): r is string => typeof r === "string")
    : null;
  const gatesRaw = Array.isArray(o.gates) ? o.gates : null;
  const gates =
    gatesRaw === null
      ? null
      : gatesRaw
          .map(parseGate)
          .filter((g): g is { step: string; status: string } => g !== null);
  const overall = asString(o.overall);
  return {
    id,
    question_latex: question,
    answer_latex: answer,
    explanation_latex: explanation ?? undefined,
    isomorphism: iso,
    preserved_dimensions: dims,
    verification_status: verif,
    ...(generationModel !== null ? { generation_model: generationModel } : {}),
    ...(refinedBy !== null ? { refined_by: refinedBy } : {}),
    ...(gates !== null ? { gates } : {}),
    ...(overall !== null ? { overall } : {}),
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
  return env ?? "http://localhost:31415";
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

  /* inputKey 는 input 의 모든 의미상 식별자를 직렬화한 안정 키.
   * effect deps 에 input 객체를 직접 넣으면 부모 re-render 마다 SSE 재연결.
   */
  const inputKey =
    input === null
      ? null
      : `${input.schoolLevel}|${input.grade ?? "common"}|${input.topic}|${input.topicName}|${input.mode}|${input.sourceItemId}|${input.sourceProblemText ?? ""}|${input.endpoint ?? ""}`;

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
        school_level: current.schoolLevel,
        grade: current.grade,
        topic: current.topic,
        topic_name: current.topicName,
        mode: current.mode,
        source_item_id: current.sourceItemId,
        source_problem_text: current.sourceProblemText,
        source_origin: current.sourceOrigin,
        generation_kind: current.generationKind,
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
          case "attempt": {
            const attempt = parseAttempt(payload);
            if (attempt !== null) {
              dispatchRef.current({ type: "ATTEMPT", attempt });
            }
            break;
          }
          case "runs": {
            const runs = parseRuns(payload);
            if (runs !== null) {
              dispatchRef.current({ type: "RUNS", runs });
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
            try {
              window.sessionStorage.setItem(
                verificationStorageKey({
                  grade: current.grade,
                  schoolLevel: current.schoolLevel,
                  topic: current.topic,
                  topicName: current.topicName,
                  mode: current.mode,
                  sourceItemId: current.sourceItemId,
                }),
                JSON.stringify(candidates),
              );
            } catch (err) {
              console.warn(
                "[verification-stream] sessionStorage write failed:",
                err,
              );
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
