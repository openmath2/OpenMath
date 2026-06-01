/**
 * OM-42: sessionStorage 기반 S4(verify) → S5(result) → S6(export) 데이터 전달.
 *
 * 왜 sessionStorage?
 *  - URL params: 4문항 LaTeX 가 너무 길어 URL 한계 초과 가능
 *  - localStorage: 다른 탭/세션과 격리 필요 (한 탭 = 한 검증 흐름)
 *  - React Context: server component (page.tsx) 가 context 못 읽음 + page reload 시 손실
 *  - sessionStorage: 한 탭 내 새로고침 견디고 다른 탭/세션엔 leak X
 *
 * SSR 환경에서 window 미정의 → typeof window === "undefined" 가드.
 * QuotaExceeded / JSON parse 실패는 silent fail → caller 가 빈 결과 받고 empty UI 표시.
 */

import type { GeneratedProblem } from "@/hooks/use-verification-stream";
import type { ResultProblem } from "@/app/app/new/result/mock";

const KEY_RESULT = "openmath_result";
const KEY_EXPORT = "openmath_export";

/* ───── narrowing (no `as any`) ───── */

function isResultProblem(v: unknown): v is ResultProblem {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.number === "number" &&
    (p.isomorphism === "structural" || p.isomorphism === "conceptual") &&
    (p.status === "pass" || p.status === "warn" || p.status === "fail") &&
    typeof p.questionLatex === "string" &&
    typeof p.answerLatex === "string" &&
    typeof p.solutionLatex === "string" &&
    Array.isArray(p.preservedDims) &&
    Array.isArray(p.missingDims) &&
    (p.failReason === null || typeof p.failReason === "string")
  );
}

function parseResultProblems(v: unknown): ResultProblem[] | null {
  if (!Array.isArray(v)) return null;
  /* 엄격 narrowing: 한 항목이라도 형식 위반이면 전체 null 반환 (silent partial 방지) */
  for (const item of v) {
    if (!isResultProblem(item)) return null;
  }
  return v as ResultProblem[];
}

/* ───── safe read/write ───── */

function safeRead(key: string): ResultProblem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return parseResultProblems(parsed);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: ResultProblem[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* QuotaExceeded / storage disabled — silent fail. caller 의 empty state UI 가 처리. */
  }
}

/* ───── public API ───── */

export function saveResultProblems(items: ResultProblem[]): void {
  safeWrite(KEY_RESULT, items);
}

export function loadResultProblems(): ResultProblem[] | null {
  return safeRead(KEY_RESULT);
}

export function saveExportProblems(items: ResultProblem[]): void {
  safeWrite(KEY_EXPORT, items);
}

export function loadExportProblems(): ResultProblem[] | null {
  return safeRead(KEY_EXPORT);
}

/**
 * FE GeneratedProblem (use-verification-stream RESULT 이벤트) → ResultProblem (result/export 화면).
 *
 * 매핑:
 *  - id/isomorphism/preserved_dimensions → 1:1
 *  - question_latex/answer_latex/explanation_latex → questionLatex/answerLatex/solutionLatex (rename + optional fallback)
 *  - verification_status: pass/partial/fail → status: pass/warn/fail (partial → warn)
 *  - number: idx+1 합성 (FE GeneratedProblem 엔 인덱스 없음)
 *  - missingDims: agent 미제공 → []
 *  - failReason: agent 미제공 → status=fail 일 때 기본 메시지
 */
export function generatedToResult(
  g: GeneratedProblem,
  idx: number,
): ResultProblem {
  const status: ResultProblem["status"] =
    g.verification_status === "pass"
      ? "pass"
      : g.verification_status === "partial"
        ? "warn"
        : "fail";
  return {
    id: g.id,
    number: idx + 1,
    isomorphism: g.isomorphism,
    status,
    questionLatex: g.question_latex,
    answerLatex: g.answer_latex,
    solutionLatex: g.explanation_latex ?? "",
    preservedDims: g.preserved_dimensions,
    missingDims: [],
    failReason: status === "fail" ? "검증 실패" : null,
  };
}
