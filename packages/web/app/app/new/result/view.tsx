"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { LatexRenderer } from "@/components/math/latex-renderer";
import {
  loadResultProblems,
  saveExportProblems,
} from "@/lib/session-store";
import { saveWorkSession } from "@/lib/work-session";
import { type Grade, type Topic, gradeLabel } from "../topic/data";
import type { ResultProblem, ResultStatus } from "./mock";

type Filter = "all" | "structural" | "conceptual" | "warn";

type Props = {
  grade: Grade | null;
  topic: Topic | null;
  mode: "structural" | "conceptual" | null;
  dims: string[];
  problems: ResultProblem[];
};

/* OM-81: BE verify-partial 응답 shape (agent/src/server/routes/verify-partial.ts).
 * 별도 패키지 import 가 불가능해 wire 형태로 로컬 정의.
 */
type OverallVerdict = "verified" | "rejected" | "warning";
type GateStatus = "passed" | "failed" | "skipped";
type GateResult = {
  step: string;
  status: GateStatus;
  duration_ms: number;
  failure_detail?: { code: string; message: string };
};

/* 카드별 편집/재검증 결과 override.
 * 원본 ResultProblem 은 mock 이라 mutate 하지 않고 별도 map 으로 덮어쓴다.
 */
type CardOverride = {
  questionLatex?: string;
  status?: ResultStatus;
  failReason?: string | null;
};

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "structural", label: "구조동형" },
  { value: "conceptual", label: "개념동형" },
  { value: "warn", label: "주의" },
];

function badgeFor(p: {
  status: ResultStatus;
  isomorphism: "structural" | "conceptual";
}): {
  className: "badge-pass" | "badge-concept" | "badge-warn" | "badge-fail";
  icon: string;
  text: string;
  srLabel: string;
} {
  if (p.status === "fail") {
    return {
      className: "badge-fail",
      icon: "✗",
      text: "실패",
      srLabel: "검증 실패 — 검토 필요",
    };
  }
  if (p.status === "warn") {
    return {
      className: "badge-warn",
      icon: "⚠",
      text: "주의",
      srLabel: "부분 통과 — 평가 차원 일부 미보존",
    };
  }
  if (p.isomorphism === "structural") {
    return {
      className: "badge-pass",
      icon: "✓",
      text: "구조",
      srLabel: "구조 동형으로 검증 통과",
    };
  }
  return {
    className: "badge-concept",
    icon: "✦",
    text: "개념",
    srLabel: "개념 동형으로 검증 통과",
  };
}

function matchesFilter(p: ResultProblem, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "structural":
      return p.isomorphism === "structural" && p.status !== "fail";
    case "conceptual":
      return p.isomorphism === "conceptual" && p.status !== "fail";
    case "warn":
      return p.status === "warn";
  }
}

/* OM-42: OM-81 partial-reverify override 를 ResultProblem 본체에 머지.
 * sessionStorage 로 export 화면에 넘기기 전에 호출. failReason 은 명시적 null 도 의미 있음
 * (이전 fail → 재검증 후 pass) → undefined 검사로 구분. */
function applyOverride(
  p: ResultProblem,
  ov: CardOverride | undefined,
): ResultProblem {
  if (ov === undefined) return p;
  return {
    ...p,
    questionLatex: ov.questionLatex ?? p.questionLatex,
    status: ov.status ?? p.status,
    failReason: ov.failReason !== undefined ? ov.failReason : p.failReason,
  };
}

/* IntentSchema (packages/agent/src/schemas/intent.schema.ts) 호환 dummy.
 * mock ResultProblem 에 intent 가 없어 partial reverify POST 위해 합성한다.
 * 추후 실제 agent 응답 (GeneratedProblem.inferred_intent) 이 ResultProblem 에 포함되면 제거.
 */
function buildPlaceholderIntent(
  topic: Topic,
  dims: string[],
  grade: Grade,
): {
  objective_code: string;
  objective_description: string;
  evaluation_dimensions: Array<{
    id: string;
    description: string;
    must_preserve: boolean;
  }>;
  required_techniques: string[];
  forbidden_techniques: string[];
  surface_constraints: {
    difficulty: "easy" | "medium" | "hard";
    problem_type: "objective";
  };
} {
  const codePattern = /^(9수|10공수)\d{2}-\d{2}$/;
  const objectiveCode = codePattern.test(topic.code) ? topic.code : "9수00-00";
  /* I-I1: ≥1, I-I2: ≥1 must_preserve=true → 첫 항목을 true 로. */
  const intentDims =
    dims.length > 0
      ? dims.map((d, i) => ({
          id: d,
          description: d,
          must_preserve: i === 0,
        }))
      : [{ id: "P", description: "placeholder", must_preserve: true }];
  const difficulty: "easy" | "medium" | "hard" =
    grade === 1 ? "easy" : grade === 2 ? "medium" : "hard";
  return {
    objective_code: objectiveCode,
    objective_description: topic.name,
    evaluation_dimensions: intentDims,
    required_techniques: [],
    forbidden_techniques: [],
    surface_constraints: { difficulty, problem_type: "objective" },
  };
}

function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  /* SSR 또는 비표준 환경 fallback. BE 가 uuid 검증하므로 valid format 유지. */
  return "00000000-0000-0000-0000-000000000000";
}

function overallToStatus(overall: OverallVerdict): ResultStatus {
  if (overall === "verified") return "pass";
  if (overall === "warning") return "warn";
  return "fail";
}

function asPartialResponse(
  data: unknown,
):
  | { ok: true; gates: GateResult[]; overall: OverallVerdict }
  | { ok: false; error: string } {
  if (data === null || typeof data !== "object") {
    return { ok: false, error: "응답이 객체가 아닙니다" };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.error === "string") {
    return { ok: false, error: obj.error };
  }
  if (!Array.isArray(obj.gates) || typeof obj.overall !== "string") {
    return { ok: false, error: "응답 형식이 올바르지 않습니다" };
  }
  const overall = obj.overall;
  if (overall !== "verified" && overall !== "warning" && overall !== "rejected") {
    return { ok: false, error: `알 수 없는 overall: ${overall}` };
  }
  return { ok: true, gates: obj.gates as GateResult[], overall };
}

export function ResultView({
  grade,
  topic,
  mode,
  dims,
  problems: propProblems,
}: Props) {
  /* OM-42: 실제 데이터는 sessionStorage 에 있음. prop 은 server-side 초기값 (빈 배열).
   * useEffect 가 mount 후 sessionStorage 에서 로드해 setProblems. */
  const [problems, setProblems] = useState<ResultProblem[]>(propProblems);
  const [hydrated, setHydrated] = useState<boolean>(false);
  /* OM-45: 빈 상태 분기용 — 처음부터 비어 있었는지 vs 삭제로 0 되었는지 구분.
   * initialCount 가 0 이면 검증 미진행, > 0 인데 problems.length===0 이면 모두 삭제됨. */
  const [initialCount, setInitialCount] = useState<number>(0);
  /* OM-45: 재생성 진행 중인 카드 id — spinner overlay 표시용. */
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  /* OM-45 후속 (sprint-5-followups 부록): 삭제 직후 5초 undo toast.
   * deletedCard 가 non-null 인 동안 toast 가 보이고, undoTimer 가 5초 후 자동 dismiss.
   * undo 클릭 시 카드 + adopted + overrides 복원 (편집 상태는 복원 안 함 — 새 컨텍스트). */
  const [deletedCard, setDeletedCard] = useState<{
    card: ResultProblem;
    wasAdopted: boolean;
    override: CardOverride | undefined;
  } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const loaded = loadResultProblems();
    if (loaded !== null) {
      setProblems(loaded);
      setInitialCount(loaded.length);
    }
    setHydrated(true);
  }, []);

  /* OM-75: 결과 hydrate 완료 시 localStorage 에 work-session 저장 (한 번만).
   *  - useRef 가 마운트 1 회 발사 보장 — OM-45 삭제/OM-81 override 로 problems 가 변해도 재저장 안 함.
   *  - 사용자가 S5 도달 = 검증 통과한 후보를 본 시점. 탭을 닫아도 S0 "최근 작업" 으로 복구 가능.
   *  - grade/topic/mode 가 null 인 invalid 진입 케이스는 저장 안 함. */
  const hasSavedSessionRef = useRef<boolean>(false);
  useEffect(() => {
    if (hasSavedSessionRef.current) return;
    if (!hydrated || problems.length === 0) return;
    if (grade === null || topic === null || mode === null) return;
    saveWorkSession({
      grade,
      topic: topic.code,
      mode,
      dims,
      problems,
    });
    hasSavedSessionRef.current = true;
  }, [hydrated, problems, grade, topic, mode, dims]);

  const [filter, setFilter] = useState<Filter>("all");
  const [adopted, setAdopted] = useState<Set<string>>(new Set());

  /* OM-81: 편집 상태 + 재검증 결과 override. */
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingLatex, setEditingLatex] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, CardOverride>>({});

  const visible = useMemo(
    () => problems.filter((p) => matchesFilter(p, filter)),
    [problems, filter],
  );

  if (grade === null || topic === null || mode === null) {
    return (
      <>
        <nav className="container-app sub-nav" aria-label="단계 이동">
          <Link href="/app" className="crumb">
            <span aria-hidden="true">←</span>
            <span>워크스페이스</span>
          </Link>
        </nav>
        <main className="container-app page-body">
          <h1 className="page-title">이전 단계 정보가 필요해요</h1>
          <p className="page-subtitle">
            결과를 보기 전에 학년 · 단원 · 동형 모드를 먼저 선택해
            주세요.
          </p>
          <Link href="/app/new/grade" className="btn btn-primary">
            <span>학년 선택으로</span>
            <span aria-hidden="true">→</span>
          </Link>
        </main>
      </>
    );
  }

  /* OM-42 + OM-45: 빈 상태 두 가지 분기.
   *  - initialCount === 0 → 처음부터 빈 sessionStorage (검증 미진행 / 새 탭 진입)
   *  - initialCount > 0   → OM-45 삭제로 모두 사라짐 ("모든 문항이 삭제됐습니다")
   * hydrated 전엔 잠시 SSR-empty 상태가 보이지만 useEffect 가 즉시 setProblems → re-render. */
  if (hydrated && problems.length === 0) {
    const allDeleted = initialCount > 0;
    return (
      <>
        <nav className="container-app sub-nav" aria-label="단계 이동">
          <Link href="/app/new/verify" className="crumb">
            <span aria-hidden="true">←</span>
            <span>검증 진행</span>
          </Link>
        </nav>
        <main className="container-app page-body">
          <h1 className="page-title">
            {allDeleted ? "모든 문항이 삭제됐습니다" : "결과 데이터가 없어요"}
          </h1>
          <p className="page-subtitle">
            {allDeleted
              ? "다시 검증해 새 문항을 받거나 워크스페이스로 돌아갈 수 있습니다."
              : "검증을 완료한 뒤 이 화면으로 자동 이동합니다. 새 탭에서 바로 진입한 경우엔 검증부터 시작해 주세요."}
          </p>
          <Link
            href={`/app/new/verify?grade=${grade}&topic=${encodeURIComponent(topic.code)}&mode=${mode}&dims=${dims.join(",")}`}
            className="btn btn-primary"
          >
            <span>{allDeleted ? "다시 검증" : "검증 화면으로"}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </main>
      </>
    );
  }

  const toggleAdopt = (id: string): void => {
    setAdopted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /* OM-81 helpers */
  const startEdit = (p: ResultProblem): void => {
    setEditingCardId(p.id);
    setEditingLatex(overrides[p.id]?.questionLatex ?? p.questionLatex);
    setEditError(null);
  };

  const cancelEdit = (): void => {
    setEditingCardId(null);
    setEditingLatex("");
    setEditError(null);
  };

  /* OM-45: 삭제 — confirm 팝업 없이 즉시 반영. adopted Set / overrides map / editing 상태도 함께 정리.
   * OM-45 후속: 삭제된 카드 정보를 deletedCard 에 snapshot — 5초간 undo 가능. */
  const handleDelete = (cardId: string): void => {
    const target = problems.find((p) => p.id === cardId);
    if (target === undefined) return;
    const snapshot = {
      card: target,
      wasAdopted: adopted.has(cardId),
      override: overrides[cardId],
    };
    setProblems((prev) => prev.filter((p) => p.id !== cardId));
    setAdopted((prev) => {
      if (!prev.has(cardId)) return prev;
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
    setOverrides((prev) => {
      if (prev[cardId] === undefined) return prev;
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
    if (editingCardId === cardId) cancelEdit();
    if (regeneratingId === cardId) setRegeneratingId(null);

    /* OM-45 후속: 5초 undo toast. 이전 timer 있으면 취소 (다중 삭제 시 마지막만 undo 가능). */
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }
    setDeletedCard(snapshot);
    undoTimerRef.current = window.setTimeout(() => {
      setDeletedCard(null);
      undoTimerRef.current = null;
    }, 5000);
  };

  /* OM-45 후속: undo toast 클릭 시 삭제 전 상태 복원. */
  const handleUndoDelete = (): void => {
    if (deletedCard === null) return;
    const { card, wasAdopted, override } = deletedCard;
    /* 카드 원래 위치 (number 순서) 에 다시 삽입 — sort by number 유지. */
    setProblems((prev) => {
      if (prev.some((p) => p.id === card.id)) return prev;
      const next = [...prev, card];
      next.sort((a, b) => a.number - b.number);
      return next;
    });
    if (wasAdopted) {
      setAdopted((prev) => {
        if (prev.has(card.id)) return prev;
        const next = new Set(prev);
        next.add(card.id);
        return next;
      });
    }
    if (override !== undefined) {
      setOverrides((prev) => ({ ...prev, [card.id]: override }));
    }
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setDeletedCard(null);
  };

  /* unmount 시 timer 정리. */
  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  /* OM-45: 재생성 — BE /api/generate/single 엔드포인트 부재로 현재는 alert 만.
   * setTimeout(0) 으로 alert 를 다음 tick 으로 미뤄 React 가 spinner overlay 잠시 보여줄 기회 부여.
   *
   * TODO: BE /api/generate/single 구현 시 아래 mock 분기 제거하고 실제 fetch 로 교체:
   *
   *   const card = problems.find((p) => p.id === cardId);
   *   if (card === undefined) return;
   *   setRegeneratingId(cardId);
   *   try {
   *     const res = await fetch("/api/generate/single", {
   *       method: "POST",
   *       headers: { "Content-Type": "application/json" },
   *       body: JSON.stringify({
   *         candidate_id: cardId,
   *         intent: buildPlaceholderIntent(topic, dims, grade),
   *         grade, topic: topic.code, mode, difficulty, problem_type,
   *       }),
   *     });
   *     const data: unknown = await res.json();
   *     // narrowing → setProblems(prev => prev.map(p => p.id === cardId ? mapped : p));
   *   } catch (err) {
   *     console.error("[regenerate] failed:", err);
   *   } finally {
   *     setRegeneratingId(null);
   *   }
   */
  const handleRegenerate = (cardId: string): void => {
    setRegeneratingId(cardId);
    window.setTimeout(() => {
      window.alert(
        "재생성 기능은 준비 중입니다.\n(BE /api/generate/single 엔드포인트 미구현)",
      );
      setRegeneratingId(null);
    }, 0);
  };

  const onEditorKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    }
  };

  const handleSave = async (): Promise<void> => {
    if (editingCardId === null) return;
    const card = problems.find((p) => p.id === editingCardId);
    if (card === undefined) return;
    setIsSaving(true);
    setEditError(null);
    try {
      const res = await fetch("/api/verify/partial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: newUuid(),
          question_text: editingLatex,
          expected_answer: card.answerLatex,
          intent: buildPlaceholderIntent(topic, dims, grade),
        }),
      });
      const data: unknown = await res.json();
      const parsed = asPartialResponse(data);
      if (!parsed.ok) {
        setEditError(
          res.ok
            ? parsed.error
            : `재검증 실패 (${res.status}): ${parsed.error}`,
        );
        return;
      }
      const newStatus = overallToStatus(parsed.overall);
      const failGate = parsed.gates.find((g) => g.status === "failed");
      const failReason =
        newStatus === "fail"
          ? failGate?.failure_detail?.message ?? "재검증 실패"
          : null;
      setOverrides((prev) => ({
        ...prev,
        [editingCardId]: {
          questionLatex: editingLatex,
          status: newStatus,
          failReason,
        },
      }));
      setEditingCardId(null);
      setEditingLatex("");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "재검증 요청 실패");
    } finally {
      setIsSaving(false);
    }
  };

  const adoptedCount = adopted.size;
  const passedCount = problems.filter((p) => {
    const eff = overrides[p.id]?.status ?? p.status;
    return eff !== "fail";
  }).length;
  const verifyHref = `/app/new/verify?grade=${grade}&topic=${encodeURIComponent(topic.code)}&mode=${mode}&dims=${dims.join(",")}`;
  const exportHref =
    adoptedCount > 0
      ? `/app/new/export?grade=${grade}&topic=${encodeURIComponent(topic.code)}&mode=${mode}&dims=${dims.join(",")}&adopted=${Array.from(adopted).join(",")}`
      : null;

  return (
    <>
      <nav className="container-app sub-nav" aria-label="단계 이동">
        <div>
          <Link href={verifyHref} className="crumb">
            <span aria-hidden="true">←</span>
            <span>검증 진행</span>
          </Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current">결과</span>
        </div>
        <span className="progress" aria-hidden="true">
          {gradeLabel(grade)} · {topic.name}
        </span>
      </nav>

      <main className="container-app page-body">
        <h1 className="page-title" id="page-title">
          {passedCount} 개 문항이 준비되었습니다
        </h1>
        <p className="page-subtitle">
          채택할 문항에 별표를 표시하세요. 채택된 문항만 PDF 에
          포함됩니다.
        </p>

        <div className="filter-row" role="toolbar" aria-label="결과 필터">
          {filters.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                className="filter-chip"
                aria-pressed={active}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <p className="empty-state">
            현재 필터에 해당하는 문항이 없습니다.
          </p>
        ) : (
          <div className="result-grid" aria-label="검증된 문항">
            {visible.map((p) => {
              const ov = overrides[p.id];
              const effStatus: ResultStatus = ov?.status ?? p.status;
              const effFailReason =
                ov?.failReason !== undefined ? ov.failReason : p.failReason;
              const effQuestionLatex = ov?.questionLatex ?? p.questionLatex;
              const badge = badgeFor({
                status: effStatus,
                isomorphism: p.isomorphism,
              });
              const isAdopted = adopted.has(p.id);
              const failed = effStatus === "fail";
              const partial = effStatus === "warn";
              const isEditing = editingCardId === p.id;
              return (
                <article
                  key={p.id}
                  className={`result-card${failed ? " failed" : ""}${
                    isAdopted ? " adopted" : ""
                  }`}
                  aria-labelledby={`card-${p.id}-num`}
                >
                  <header className="card-head">
                    <span className="number" id={`card-${p.id}-num`}>
                      #{p.number}
                    </span>
                    <span
                      className={`badge ${badge.className}`}
                      aria-label={badge.srLabel}
                    >
                      <span aria-hidden="true">{badge.icon}</span>
                      <span>{badge.text}</span>
                    </span>
                    <div className="icon-cluster">
                      <button
                        type="button"
                        className="btn-icon-circular"
                        aria-pressed={isAdopted}
                        aria-label={isAdopted ? "채택 해제" : "채택"}
                        onClick={() => toggleAdopt(p.id)}
                        disabled={failed || isEditing}
                      >
                        <span aria-hidden="true">
                          {isAdopted ? "★" : "☆"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn-icon-circular"
                        aria-label="다시 생성"
                        onClick={() => handleRegenerate(p.id)}
                        disabled={isEditing || regeneratingId === p.id}
                      >
                        <span aria-hidden="true">↻</span>
                      </button>
                      <button
                        type="button"
                        className="btn-icon-circular"
                        aria-label={isEditing ? "편집 중" : "수정"}
                        aria-pressed={isEditing}
                        onClick={() => (isEditing ? cancelEdit() : startEdit(p))}
                        disabled={
                          (isSaving && !isEditing) ||
                          regeneratingId === p.id
                        }
                      >
                        <span aria-hidden="true">✎</span>
                      </button>
                      <button
                        type="button"
                        className="btn-icon-circular"
                        aria-label="폐기"
                        onClick={() => handleDelete(p.id)}
                        disabled={isEditing || regeneratingId === p.id}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                  </header>

                  {failed && effFailReason !== null ? (
                    <div
                      className="inline-notice inline-notice-fail"
                      role="status"
                    >
                      <span className="icon" aria-hidden="true">
                        ✗
                      </span>
                      <span className="body">{effFailReason}</span>
                    </div>
                  ) : null}

                  {partial && p.missingDims.length > 0 ? (
                    <div
                      className="inline-notice inline-notice-warn"
                      role="status"
                    >
                      <span className="icon" aria-hidden="true">
                        ⚠
                      </span>
                      <span className="body">
                        평가 차원 [{p.missingDims.join(", ")}] 미보존 —
                        채택 시 학습 목표가 어긋날 수 있습니다.
                      </span>
                    </div>
                  ) : null}

                  {isEditing && editError !== null ? (
                    <div
                      className="inline-notice inline-notice-fail"
                      role="alert"
                    >
                      <span className="icon" aria-hidden="true">
                        ✗
                      </span>
                      <span className="body">{editError}</span>
                    </div>
                  ) : null}

                  <div className="card-body" style={{ position: "relative" }}>
                    {/* OM-45: 재생성 진행 중 spinner overlay (BE endpoint 구현 시 실 동작). */}
                    {regeneratingId === p.id ? (
                      <div
                        role="status"
                        aria-live="polite"
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "grid",
                          placeItems: "center",
                          background:
                            "color-mix(in srgb, var(--color-canvas-pure) 78%, transparent)",
                          zIndex: 2,
                        }}
                      >
                        <span className="spinner-dot" aria-hidden="true" />
                        <span className="sr-only">재생성 중…</span>
                      </div>
                    ) : null}
                    {isEditing ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                          padding: 16,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "stretch",
                          }}
                        >
                          <textarea
                            value={editingLatex}
                            onChange={(e) => setEditingLatex(e.target.value)}
                            onKeyDown={onEditorKey}
                            placeholder="LaTeX를 입력하세요"
                            disabled={isSaving}
                            autoFocus
                            aria-label="LaTeX 입력"
                            style={{
                              flex: 1,
                              minHeight: 140,
                              padding: 12,
                              fontFamily: "var(--font-mono)",
                              fontSize: 14,
                              lineHeight: 1.5,
                              border: "1px solid var(--color-hairline)",
                              background: "var(--color-canvas-pure)",
                              color: "var(--color-ink)",
                              resize: "vertical",
                            }}
                          />
                          <div
                            style={{ flex: 1, minWidth: 0 }}
                            aria-label="미리보기"
                          >
                            <div className="formula-stage">
                              <LatexRenderer
                                latex={
                                  editingLatex.trim() === ""
                                    ? "\\,"
                                    : editingLatex
                                }
                                block
                              />
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 8,
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={cancelEdit}
                            disabled={isSaving}
                          >
                            <span>취소</span>
                            <span
                              aria-hidden="true"
                              style={{ marginLeft: 6, opacity: 0.7 }}
                            >
                              Esc
                            </span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ink"
                            onClick={() => void handleSave()}
                            disabled={isSaving || editingLatex.trim() === ""}
                          >
                            <span>저장 + 재검증</span>
                            <span
                              aria-hidden="true"
                              style={{ marginLeft: 6, opacity: 0.7 }}
                            >
                              ⌘↵
                            </span>
                          </button>
                        </div>
                        {isSaving ? (
                          <div
                            role="status"
                            aria-live="polite"
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "grid",
                              placeItems: "center",
                              background:
                                "color-mix(in srgb, var(--color-canvas-pure) 78%, transparent)",
                              zIndex: 1,
                            }}
                          >
                            <span
                              className="spinner-dot"
                              aria-hidden="true"
                            />
                            <span className="sr-only">재검증 중…</span>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="formula-stage">
                        <LatexRenderer latex={effQuestionLatex} block />
                      </div>
                    )}
                  </div>

                  <div className="card-meta">
                    <div className="answer">
                      <span className="answer-label">답</span>
                      <LatexRenderer latex={p.answerLatex} />
                    </div>
                    <details className="disclosure-row solution-disclosure">
                      <summary>
                        <span>풀이 보기</span>
                        <span className="chevron" aria-hidden="true">
                          ⌄
                        </span>
                      </summary>
                      <div className="solution-body">
                        <LatexRenderer latex={p.solutionLatex} />
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* OM-45 후속: 삭제 직후 5초 undo toast. fixed 위치로 action-bar 위에 떠 있음.
          DESIGN.md 토큰 (inline-notice-warn) 재사용 + position:fixed 만 추가. */}
      {deletedCard !== null ? (
        <div
          role="status"
          aria-live="polite"
          className="inline-notice inline-notice-warn"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 88,
            transform: "translateX(-50%)",
            zIndex: 100,
            minWidth: 320,
            maxWidth: "calc(100vw - 32px)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
          }}
        >
          <span className="icon" aria-hidden="true">⚠</span>
          <span className="body" style={{ flex: 1 }}>
            #{deletedCard.card.number} 문항이 삭제됐습니다 (5초 안에 되돌릴 수 있어요)
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleUndoDelete}
            style={{ marginLeft: 12, flexShrink: 0 }}
          >
            <span>되돌리기</span>
          </button>
        </div>
      ) : null}

      <div className="action-bar-sticky">
        <div className="container-app action-bar-inner">
          <div className="left">
            <Link href={verifyHref} className="btn btn-secondary">
              <span aria-hidden="true">↻</span>
              <span>다시 검증</span>
            </Link>
          </div>
          <div className="right">
            {exportHref !== null ? (
              <Link
                href={exportHref}
                className="btn btn-ink"
                onClick={() => {
                  /* OM-42: 채택된 문항 (override 머지) 을 sessionStorage 에 저장.
                   * Link default 네비게이션이 이어지지만 onClick 가 먼저 실행되므로 race 없음.
                   * 이전엔 export/page.tsx 가 URL 의 adopted= 로 mock 에서 필터했으나
                   * 이제 sessionStorage 가 단일 출처. */
                  const adoptedItems = problems
                    .filter((p) => adopted.has(p.id))
                    .map((p) => applyOverride(p, overrides[p.id]));
                  saveExportProblems(adoptedItems);
                }}
              >
                <span>PDF 만들기</span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-ink"
                disabled
                aria-describedby="export-reason"
              >
                <span>PDF 만들기</span>
                <span aria-hidden="true">→</span>
              </button>
            )}
            <span id="export-reason" className="sr-only">
              1 개 이상의 문항을 채택하세요.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
