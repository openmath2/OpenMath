"use client";

/**
 * OM-47: 작업 흐름 (S1→S3) 의 사용자 선택을 localStorage 에 저장 / 복구.
 *
 * 왜 localStorage?
 *  - sessionStorage: 탭 닫으면 사라짐 (OM-47 의 핵심 요구사항 = 탭 닫고 돌아와도 복구)
 *  - localStorage: 같은 origin 의 모든 탭 + 브라우저 재시작 후에도 유지. 한 개의 draft 만 보관.
 *
 * sessionStorage (OM-42, lib/session-store.ts) 와는 별개 도메인:
 *  - sessionStorage: 검증 결과 (S4→S5→S6 데이터 전달, 한 탭 격리)
 *  - localStorage  : 작업 입력값 (S0 "이어서 작업하기" 복구)
 *
 * SSR 안전 — typeof window === "undefined" 가드 + try/catch (QuotaExceeded / disabled storage 대비).
 */

const STORAGE_KEY = "openmath_draft";

export type Difficulty = "easy" | "medium" | "hard";
export type ProblemType = "objective" | "short_answer";
export type IsomorphismMode = "structural" | "conceptual";

export type DraftData = {
  savedAt: string; // ISO 8601
  grade: 1 | 2 | 3 | null;
  topic: string | null;
  mode: IsomorphismMode | null;
  dims: string[];
  difficulty: Difficulty | null;
  problem_type: ProblemType | null;
  /* result 는 sessionStorage (OM-42 openmath_result) 가 담당.
   * draft 가 localStorage 로 다루는 것은 *입력값* 만 — 결과는 별개 source. */
  result: null;
};

/* ───── narrowing (no `as any`) ───── */

function isGrade(v: unknown): v is 1 | 2 | 3 {
  return v === 1 || v === 2 || v === 3;
}

function isMode(v: unknown): v is IsomorphismMode {
  return v === "structural" || v === "conceptual";
}

function isDifficulty(v: unknown): v is Difficulty {
  return v === "easy" || v === "medium" || v === "hard";
}

function isProblemType(v: unknown): v is ProblemType {
  return v === "objective" || v === "short_answer";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function parseDraft(raw: unknown): DraftData | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const savedAt = typeof obj.savedAt === "string" ? obj.savedAt : null;
  if (savedAt === null) return null;
  return {
    savedAt,
    grade: isGrade(obj.grade) ? obj.grade : null,
    topic: typeof obj.topic === "string" ? obj.topic : null,
    mode: isMode(obj.mode) ? obj.mode : null,
    dims: asStringArray(obj.dims),
    difficulty: isDifficulty(obj.difficulty) ? obj.difficulty : null,
    problem_type: isProblemType(obj.problem_type) ? obj.problem_type : null,
    result: null,
  };
}

/* ───── hook ───── */

/**
 * load / save / clear 의 reference 가 매 render 마다 새로 생성되지만, 본 hook 은 effect deps 로
 * 함수를 받는 패턴이 아니라 호출 시점 fresh value 만 필요로 한다. memoization 불필요.
 */
export function useDraftStorage(): {
  saveDraft: (patch: Partial<Omit<DraftData, "savedAt">>) => void;
  loadDraft: () => DraftData | null;
  clearDraft: () => void;
} {
  const loadDraft = (): DraftData | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      return parseDraft(parsed);
    } catch (err) {
      console.error("[useDraftStorage] load failed:", err);
      return null;
    }
  };

  const saveDraft = (patch: Partial<Omit<DraftData, "savedAt">>): void => {
    if (typeof window === "undefined") return;
    try {
      const existing = loadDraft();
      /* 기존 draft 와 patch 머지. 빈 draft (existing===null) 인 경우 기본값으로 채움. */
      const base: Omit<DraftData, "savedAt"> = existing ?? {
        grade: null,
        topic: null,
        mode: null,
        dims: [],
        difficulty: null,
        problem_type: null,
        result: null,
      };
      const merged: DraftData = {
        ...base,
        ...patch,
        result: null,
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (err) {
      console.error("[useDraftStorage] save failed:", err);
    }
  };

  const clearDraft = (): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("[useDraftStorage] clear failed:", err);
    }
  };

  return { saveDraft, loadDraft, clearDraft };
}
