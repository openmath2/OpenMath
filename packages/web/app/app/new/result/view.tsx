"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LatexAuto } from "@/components/math/latex-renderer";
import { type Grade, type SchoolLevel, type Topic, gradeLabel } from "../topic/data";
import { verificationStorageKey } from "@/lib/verification-storage-key";
import type { ResultProblem } from "./types";

type Filter = "all" | "structural" | "conceptual" | "warn";

type Props = {
  schoolLevel: SchoolLevel;
  grade: Grade | null;
  topic: Topic | null;
  mode: "structural" | "conceptual" | null;
  sourceItemId: string;
  problems: ResultProblem[];
};

type StoredProblem = {
  id: string;
  question_latex: string;
  answer_latex: string;
  explanation_latex?: string;
  isomorphism: "structural" | "conceptual";
  preserved_dimensions: string[];
  verification_status: "pass" | "partial" | "fail";
  generation_model?: string;
  refined_by?: string[];
  gates?: Array<{ step: string; status: string }>;
  overall?: string;
};

const TEMPLATE_GENERATOR_ID = "deterministic-topic-generator";
const UNVERIFIED_GATE_STATUS = "unverified";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "structural", label: "구조동형" },
  { value: "conceptual", label: "개념동형" },
  { value: "warn", label: "주의" },
];

function badgeFor(p: ResultProblem): {
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
      srLabel: "부분 통과 — 검토 권장",
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

function parseStoredGate(raw: unknown): { step: string; status: string } | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const g = raw as Record<string, unknown>;
  if (typeof g.step !== "string" || typeof g.status !== "string") return null;
  return { step: g.step, status: g.status };
}

function parseStoredProblem(raw: unknown): StoredProblem | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  if (typeof o.question_latex !== "string") return null;
  if (typeof o.answer_latex !== "string") return null;
  if (o.isomorphism !== "structural" && o.isomorphism !== "conceptual") return null;
  if (o.verification_status !== "pass" && o.verification_status !== "partial" && o.verification_status !== "fail") return null;
  const refinedBy = Array.isArray(o.refined_by)
    ? o.refined_by.filter((r): r is string => typeof r === "string")
    : undefined;
  const gates = Array.isArray(o.gates)
    ? o.gates
        .map(parseStoredGate)
        .filter((g): g is { step: string; status: string } => g !== null)
    : undefined;
  return {
    id: o.id,
    question_latex: o.question_latex,
    answer_latex: o.answer_latex,
    explanation_latex: typeof o.explanation_latex === "string" ? o.explanation_latex : undefined,
    isomorphism: o.isomorphism,
    preserved_dimensions: Array.isArray(o.preserved_dimensions)
      ? o.preserved_dimensions.filter((d): d is string => typeof d === "string")
      : [],
    verification_status: o.verification_status,
    generation_model: typeof o.generation_model === "string" ? o.generation_model : undefined,
    refined_by: refinedBy,
    gates,
    overall: typeof o.overall === "string" ? o.overall : undefined,
  };
}

function toResultProblem(problem: StoredProblem, index: number): ResultProblem {
  const status = problem.verification_status === "partial" ? "warn" : problem.verification_status;
  return {
    id: problem.id,
    number: index + 1,
    isomorphism: problem.isomorphism,
    status,
    questionLatex: problem.question_latex,
    answerLatex: problem.answer_latex,
    solutionLatex: problem.explanation_latex ?? null,
    failReason: status === "fail" ? "검증 실패 — 채택할 수 없습니다." : null,
    generationModel: problem.generation_model,
    refinedBy: problem.refined_by,
    gates: problem.gates,
  };
}

function isTemplateFallback(p: ResultProblem): boolean {
  if (p.generationModel === TEMPLATE_GENERATOR_ID) return true;
  if (p.refinedBy?.includes(TEMPLATE_GENERATOR_ID) === true) return true;
  return false;
}

function hasUnverifiedGate(p: ResultProblem): boolean {
  return p.gates?.some((g) => g.status === UNVERIFIED_GATE_STATUS) === true;
}

export function ResultView({
  grade,
  schoolLevel,
  topic,
  mode,
  sourceItemId,
  problems,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [adopted, setAdopted] = useState<Set<string>>(new Set());
  const [displayProblems, setDisplayProblems] = useState<ResultProblem[]>(problems);

  useEffect(() => {
    setDisplayProblems(problems);
    if ((schoolLevel === "middle" && grade === null) || topic === null || mode === null) return;
    if (sourceItemId === "") return;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(
        verificationStorageKey({
          grade,
          schoolLevel,
          topic: topic.code,
          topicName: topic.name,
          mode,
          sourceItemId,
        }),
      );
    } catch (err) {
      console.warn("[result] sessionStorage read failed:", err);
      return;
    }
    if (raw === null) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn("[result] JSON parse failed:", err);
      return;
    }
    if (!Array.isArray(parsed)) return;
    const stored = parsed.map(parseStoredProblem);
    if (stored.some((p) => p === null)) return;
    setDisplayProblems(
      stored.map((p, index) => toResultProblem(p as StoredProblem, index)),
    );
  }, [schoolLevel, grade, topic, mode, sourceItemId, problems]);

  const visible = useMemo(
    () => displayProblems.filter((p) => matchesFilter(p, filter)),
    [displayProblems, filter],
  );

  if ((schoolLevel === "middle" && grade === null) || topic === null || mode === null) {
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

  const adoptedCount = adopted.size;
  const passedCount = displayProblems.filter((p) => p.status !== "fail").length;
  const gradeParam = grade === null ? "common" : grade;
  const srcRefQuery = sourceItemId.length > 0 ? `&srcRef=${encodeURIComponent(sourceItemId)}` : "";
  const verifyHref = `/app/new/verify?school=${schoolLevel}&grade=${gradeParam}&topic=${encodeURIComponent(topic.code)}&mode=${mode}${srcRefQuery}`;
  const exportHref =
    adoptedCount > 0
      ? `/app/new/export?school=${schoolLevel}&grade=${gradeParam}&topic=${encodeURIComponent(topic.code)}&mode=${mode}${srcRefQuery}&adopted=${Array.from(adopted).join(",")}`
      : null;

  if (displayProblems.length === 0) {
    return (
      <>
        <nav className="container-app sub-nav" aria-label="단계 이동">
          <Link href={verifyHref} className="crumb">
            <span aria-hidden="true">←</span>
            <span>검증 진행</span>
          </Link>
        </nav>
        <main className="container-app page-body">
          <h1 className="page-title">아직 검증된 문항이 없어요</h1>
          <p className="page-subtitle">
            검증을 실행하면 통과한 문항이 여기에 모입니다. 검증
            단계를 먼저 진행해 주세요.
          </p>
          <Link href={verifyHref} className="btn btn-primary">
            <span>검증 진행으로</span>
            <span aria-hidden="true">→</span>
          </Link>
        </main>
      </>
    );
  }

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
          {gradeLabel(grade, schoolLevel)} · {topic.name}
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
          {filters
            .filter(
              (f) =>
                f.value === "all" ||
                displayProblems.some((p) => matchesFilter(p, f.value)),
            )
            .map((f) => {
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
              const badge = badgeFor(p);
              const isAdopted = adopted.has(p.id);
              const failed = p.status === "fail";
              const fallback = isTemplateFallback(p);
              const unverified = hasUnverifiedGate(p);
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
                    {fallback ? (
                      <span
                        className="badge badge-fallback"
                        aria-label="자동 생성 템플릿 — AI 출력 대신 규칙 기반 템플릿으로 만든 문항"
                      >
                        <span aria-hidden="true">⚙</span>
                        <span>자동 템플릿</span>
                      </span>
                    ) : null}
                    {unverified ? (
                      <span
                        className="badge badge-unverified"
                        title="재풀이로만 확인됨 — SymPy 기호 검증을 수행할 수 없었습니다"
                        aria-label="기호 검증 불가 — 재풀이로만 확인됨"
                      >
                        <span aria-hidden="true">⊘</span>
                        <span>기호 검증 불가</span>
                      </span>
                    ) : null}
                    <div className="icon-cluster">
                      <button
                        type="button"
                        className="btn-icon-circular"
                        aria-pressed={isAdopted}
                        aria-label={
                          isAdopted ? "채택 해제" : "채택"
                        }
                        onClick={() => toggleAdopt(p.id)}
                        disabled={failed}
                      >
                        <span aria-hidden="true">
                          {isAdopted ? "★" : "☆"}
                        </span>
                      </button>
                    </div>
                  </header>

                  {failed && p.failReason !== null ? (
                    <div
                      className="inline-notice inline-notice-fail"
                      role="status"
                    >
                      <span className="icon" aria-hidden="true">
                        ✗
                      </span>
                      <span className="body">{p.failReason}</span>
                    </div>
                  ) : null}

                  <div className="card-body">
                    <div className="formula-stage question-stage">
                      <LatexAuto source={p.questionLatex} />
                    </div>
                  </div>

                  <div className="card-meta">
                    <div className="answer">
                      <span className="answer-label">답</span>
                      <LatexAuto source={p.answerLatex} />
                    </div>
                    {p.solutionLatex !== null ? (
                      <details className="disclosure-row solution-disclosure">
                        <summary>
                          <span>풀이 보기</span>
                          <span className="chevron" aria-hidden="true">
                            ⌄
                          </span>
                        </summary>
                        <div className="solution-body">
                          <LatexAuto source={p.solutionLatex} />
                        </div>
                      </details>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

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
              <Link href={exportHref} className="btn btn-ink">
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
