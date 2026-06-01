"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  type DraftData,
  useDraftStorage,
} from "@/hooks/use-draft-storage";
import { saveResultProblems } from "@/lib/session-store";
import {
  type WorkSession,
  deleteWorkSession,
  loadWorkSessions,
} from "@/lib/work-session";

/* OM-47: localStorage 의 draft 가 있을 때만 "이어서 작업하기" 카드 노출.
 * SSR 시점엔 draft 모름 → mount 후 useEffect 로 로드 → state 갱신 → 카드 렌더.
 * 첫 렌더는 카드 없는 상태이므로 flash 거의 없음. */
function ResumeSection(): React.ReactElement | null {
  const { loadDraft, clearDraft } = useDraftStorage();
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    setDraft(loadDraft());
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hydrated || draft === null) return null;

  /* 의미 있는 draft 만 보여줌 — 최소한 grade 라도 있어야 "이어서" 가 합당. */
  if (draft.grade === null) return null;

  const onClear = (): void => {
    clearDraft();
    setDraft(null);
  };

  /* 저장 시각 — locale 의존 (사용자 표시용). Date 객체 자체는 ISO string 에서 안전 parse. */
  const savedDate = new Date(draft.savedAt);
  const savedLabel = Number.isNaN(savedDate.getTime())
    ? draft.savedAt
    : savedDate.toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  const summary = [
    `${draft.grade}학년`,
    draft.topic !== null ? draft.topic : null,
    draft.mode !== null
      ? draft.mode === "structural"
        ? "구조 동형"
        : "개념 동형"
      : null,
  ]
    .filter((s): s is string => s !== null)
    .join(" · ");

  return (
    <section
      className="container-app entry-grid"
      aria-label="저장된 작업"
      style={{ marginTop: 16 }}
    >
      <article className="job-entry-card" aria-labelledby="resume-heading">
        <h2 id="resume-heading">저장된 작업이 있어요</h2>
        <p className="desc">
          탭을 닫기 전 입력한 내용이 남아 있습니다. 같은 곳에서 이어서
          진행하거나 새로 시작할 수 있습니다.
        </p>
        <p className="desc" style={{ marginTop: 8, opacity: 0.85 }}>
          <span aria-label="저장 정보">
            {summary} · 저장 시각 {savedLabel}
          </span>
        </p>
        <div className="cta-row">
          <Link href="/app/new/grade" className="btn btn-primary">
            <span>이어서 작업하기</span>
            <span aria-hidden="true">→</span>
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClear}
          >
            <span>새로 시작</span>
          </button>
        </div>
      </article>
    </section>
  );
}

/* OM-75: localStorage 의 work-session 다중 항목 노출.
 *  - 만료된 (7일 초과) 항목은 loadWorkSessions 가 load 시점에 자동 정리.
 *  - "이어서 작업": session.problems 를 sessionStorage(openmath_result) 에 옮긴 후 /app/new/result.
 *    OM-42 의 result/view.tsx hydrate 흐름이 그 데이터를 그대로 표시 (재검증 없음).
 *  - "삭제": deleteWorkSession + state 갱신 (re-load 로 만료 정리도 함께).
 *  - SSR 시점엔 sessions=[] (hydrated=false) → useEffect 가 mount 후 로드. */
function RecentWorkSection(): React.ReactElement | null {
  const router = useRouter();
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    setSessions(loadWorkSessions());
    setHydrated(true);
  }, []);

  if (!hydrated || sessions.length === 0) return null;

  const onResume = (s: WorkSession): void => {
    /* sessionStorage 의 openmath_result 키에 problems 를 옮긴 뒤 /app/new/result 로 이동.
     * OM-42 의 result/view.tsx useEffect 가 같은 키에서 hydrate. */
    saveResultProblems(s.problems);
    router.push(
      `/app/new/result?grade=${s.grade}&topic=${encodeURIComponent(s.topic)}&mode=${s.mode}&dims=${s.dims.join(",")}`,
    );
  };

  const onDelete = (id: string): void => {
    deleteWorkSession(id);
    setSessions(loadWorkSessions());
  };

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <section
      className="container-app entry-grid"
      aria-label="최근 작업"
      style={{ marginTop: 16 }}
    >
      {sessions.map((s) => (
        <article
          key={s.id}
          className="job-entry-card"
          aria-label={`${s.grade}학년 ${s.topic} ${s.problems.length}개 문항 작업`}
        >
          <h2>{s.grade}학년 · {s.topic}</h2>
          <p className="desc">
            {s.problems.length} 개 문항 · {s.mode === "structural" ? "구조 동형" : "개념 동형"}
          </p>
          <p className="desc" style={{ opacity: 0.7, fontSize: 13 }}>
            저장 시각 {formatDate(s.savedAt)} · 만료 {formatDate(s.expiresAt)}
          </p>
          <div className="cta-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onResume(s)}
            >
              <span>이어서 작업</span>
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onDelete(s.id)}
              aria-label={`${s.grade}학년 ${s.topic} 세션 삭제`}
            >
              <span>삭제</span>
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

export default function WorkspacePage() {
  return (
    <>
      <section className="hero-tile-productivity">
        <div className="container-app">
          <span className="eyebrow-mono">
            <span aria-hidden="true">◆</span>
            워크스페이스
          </span>
          <h1>검증된 문제 한 세트.</h1>
          <p className="lede">
            학년 → 단원 → 의도 → 검증 → PDF · 5 ~ 30 초 동형 출제.
          </p>
        </div>
      </section>

      {/* OM-47: 저장된 작업이 있으면 우선 노출 (없으면 null 반환) */}
      <ResumeSection />

      {/* OM-75: 7일 이내 완료한 작업 세션 (다중) — S5 결과 화면으로 직접 점프 복원 */}
      <RecentWorkSection />

      <section className="container-app entry-grid" aria-label="새 작업 시작">
        <article className="job-entry-card">
          <h2>새 문제 만들기</h2>
          <p className="desc">
            학년 · 단원 · 평가 차원을 골라 동형 문제를 만듭니다. 검증
            6 단계가 실시간으로 노출됩니다.
          </p>
          <ul>
            <li>5 ~ 30 초 출제</li>
            <li>한 번에 3 ~ 10 문항</li>
            <li>SymPy 산술 검증 + 독립 재풀이</li>
            <li>A4 PDF 다운로드</li>
          </ul>
          <div className="cta-row">
            <Link href="/app/new/grade" className="btn btn-primary">
              <span>시작하기</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>

        <article className="job-entry-card" aria-disabled="true">
          <h2>
            이 문제처럼
            <span className="hint-pill" aria-hidden="true">
              준비 중
            </span>
          </h2>
          <p className="desc">
            기존 문제 이미지를 업로드하면 동형을 추출합니다. 캡스톤
            데모 단계에서는 비활성화되어 있습니다.
          </p>
          <ul>
            <li>OCR 이미지 입력</li>
            <li>LaTeX 자동 추출</li>
            <li>같은 평가 차원 보존</li>
            <li>학년 외 기법 자동 차단</li>
          </ul>
          <div className="cta-row">
            <button
              type="button"
              className="btn btn-secondary"
              disabled
              aria-describedby="ocr-disabled-reason"
            >
              <span>준비 중</span>
            </button>
            <span id="ocr-disabled-reason" className="sr-only">
              OCR 입력은 캡스톤 데모 단계에서 비활성화되어 있습니다.
              v2 에서 도입됩니다.
            </span>
          </div>
        </article>
      </section>
    </>
  );
}
