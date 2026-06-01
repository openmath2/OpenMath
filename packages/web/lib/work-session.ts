"use client";

/**
 * OM-75: 작업 세션 영속 (localStorage, 7일 TTL).
 *
 * 도메인 분리 (세 저장소 공존):
 *  - OM-47 localStorage `openmath_draft` — *입력값* (S1 부터 재시작용 draft)
 *  - OM-42 sessionStorage `openmath_result` / `openmath_export` — 한 탭 결과 전달
 *  - **본 OM-75 localStorage `openmath:work-session:<uuid>`** — *완료 결과* 영속
 *
 * 본 모듈은 *검증 통과한 결과* 를 다중 세션으로 보관해 S0 "최근 작업" 카드에서
 * 사용자가 직접 S5 로 점프 복원할 수 있게 한다 (재검증 없음).
 *
 * problems 는 ResultProblem[] — sessionStorage `openmath_result` 형식과 동일.
 * 복원 시 sessionStorage 에 그대로 옮겨 담아 S5 view 가 OM-42 흐름으로 hydrate.
 *
 * SSR 안전 — typeof window 가드 + try/catch. 만료된 항목은 load 시점에 자동 정리.
 */

import type { ResultProblem } from "@/app/app/new/result/mock";

const STORAGE_PREFIX = "openmath:work-session:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

export interface WorkSession {
  id: string;
  savedAt: string; // ISO 8601
  expiresAt: string; // savedAt + TTL_MS
  grade: 1 | 2 | 3;
  topic: string;
  mode: "structural" | "conceptual";
  dims: string[];
  problems: ResultProblem[];
}

/* ───── narrowing ───── */

function isResultProblem(v: unknown): boolean {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.number === "number" &&
    (p.isomorphism === "structural" || p.isomorphism === "conceptual") &&
    (p.status === "pass" || p.status === "warn" || p.status === "fail") &&
    typeof p.questionLatex === "string" &&
    typeof p.answerLatex === "string"
  );
}

function parseSession(raw: unknown): WorkSession | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const grade = obj.grade;
  if (grade !== 1 && grade !== 2 && grade !== 3) return null;
  if (
    typeof obj.id !== "string" ||
    typeof obj.savedAt !== "string" ||
    typeof obj.expiresAt !== "string" ||
    typeof obj.topic !== "string" ||
    (obj.mode !== "structural" && obj.mode !== "conceptual") ||
    !Array.isArray(obj.dims) ||
    !Array.isArray(obj.problems)
  ) {
    return null;
  }
  if (!obj.dims.every((d): d is string => typeof d === "string")) return null;
  if (!obj.problems.every(isResultProblem)) return null;
  return {
    id: obj.id,
    savedAt: obj.savedAt,
    expiresAt: obj.expiresAt,
    grade,
    topic: obj.topic,
    mode: obj.mode,
    dims: obj.dims,
    problems: obj.problems as ResultProblem[],
  };
}

/* ───── public API ───── */

export function saveWorkSession(
  data: Omit<WorkSession, "id" | "savedAt" | "expiresAt">,
): void {
  if (typeof window === "undefined") return;
  try {
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    const now = new Date();
    const session: WorkSession = {
      id,
      savedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
      ...data,
    };
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${id}`,
      JSON.stringify(session),
    );
  } catch (err) {
    console.error("[work-session] save failed:", err);
  }
}

/**
 * 만료된 (expiresAt < now) 항목은 load 시점에 자동 삭제. 반환은 최신순.
 * 파싱 실패 항목도 함께 제거 (corrupted 안전망).
 */
export function loadWorkSessions(): WorkSession[] {
  if (typeof window === "undefined") return [];
  try {
    const sessions: WorkSession[] = [];
    const now = new Date();
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key === null || !key.startsWith(STORAGE_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (raw === null) continue;
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        toRemove.push(key); // corrupted JSON
        continue;
      }
      const session = parseSession(parsedJson);
      if (session === null) {
        toRemove.push(key); // schema mismatch
        continue;
      }
      const expires = new Date(session.expiresAt);
      if (Number.isNaN(expires.getTime()) || expires < now) {
        toRemove.push(key); // 만료
        continue;
      }
      sessions.push(session);
    }
    for (const key of toRemove) {
      window.localStorage.removeItem(key);
    }
    return sessions.sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    );
  } catch (err) {
    console.error("[work-session] load failed:", err);
    return [];
  }
}

export function deleteWorkSession(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
  } catch (err) {
    console.error("[work-session] delete failed:", err);
  }
}
