"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LatexRenderer } from "@/components/math/latex-renderer";
import { type Grade, type Topic, gradeLabel } from "../topic/data";
import type { ResultProblem } from "./mock";

type Filter = "all" | "structural" | "conceptual" | "warn";

type Props = {
  grade: Grade | null;
  topic: Topic | null;
  mode: "structural" | "conceptual" | null;
  dims: string[];
  sourceProblemText: string;
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
};

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

function storageKey(
  grade: Grade,
  topic: Topic,
  mode: "structural" | "conceptual",
  dims: string[],
  sourceProblemText: string,
): string {
  return [
    "openmath:verification-result",
    grade,
    topic.code,
    topic.name,
    mode,
    [...dims].sort().join(","),
    sourceProblemText,
  ].join("|");
}

function sourceQuery(sourceProblemText: string): string {
  return sourceProblemText.length > 0
    ? `&source=${encodeURIComponent(sourceProblemText)}`
    : "";
}

function parseStoredProblem(raw: unknown): StoredProblem | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  if (typeof o.question_latex !== "string") return null;
  if (typeof o.answer_latex !== "string") return null;
  if (o.isomorphism !== "structural" && o.isomorphism !== "conceptual") return null;
  if (o.verification_status !== "pass" && o.verification_status !== "partial" && o.verification_status !== "fail") return null;
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
  };
}

function toResultProblem(problem: StoredProblem, index: number, dims: string[]): ResultProblem {
  const status = problem.verification_status === "partial" ? "warn" : problem.verification_status;
  const missingDims = dims.filter((dim) => !problem.preserved_dimensions.includes(dim));
  return {
    id: problem.id,
    number: index + 1,
    isomorphism: problem.isomorphism,
    status,
    questionLatex: problem.question_latex,
    answerLatex: problem.answer_latex,
    solutionLatex: problem.explanation_latex ?? "검증 파이프라인에서 생성된 문항입니다.",
    preservedDims: problem.preserved_dimensions,
    missingDims: status === "warn" ? missingDims : [],
    failReason: status === "fail" ? "검증 실패 — 채택할 수 없습니다." : null,
  };
}

export function ResultView({
  grade,
  topic,
  mode,
  dims,
  sourceProblemText,
  problems,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [adopted, setAdopted] = useState<Set<string>>(new Set());
  const [displayProblems, setDisplayProblems] = useState<ResultProblem[]>(problems);

  useEffect(() => {
    setDisplayProblems(problems);
    if (grade === null || topic === null || mode === null) return;
    try {
      const raw = window.sessionStorage.getItem(
        storageKey(grade, topic, mode, dims, sourceProblemText),
      );
      if (raw === null) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const stored = parsed.map(parseStoredProblem);
      if (stored.some((p) => p === null)) return;
      setDisplayProblems(
        stored.map((p, index) => toResultProblem(p as StoredProblem, index, dims)),
      );
    } catch {
      setDisplayProblems(problems);
    }
  }, [grade, topic, mode, dims, sourceProblemText, problems]);

  const visible = useMemo(
    () => displayProblems.filter((p) => matchesFilter(p, filter)),
    [displayProblems, filter],
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
  const verifyHref = `/app/new/verify?grade=${grade}&topic=${encodeURIComponent(topic.code)}&mode=${mode}&dims=${dims.join(",")}${sourceQuery(sourceProblemText)}`;
  const exportHref =
    adoptedCount > 0
      ? `/app/new/export?grade=${grade}&topic=${encodeURIComponent(topic.code)}&mode=${mode}&dims=${dims.join(",")}${sourceQuery(sourceProblemText)}&adopted=${Array.from(adopted).join(",")}`
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
              const badge = badgeFor(p);
              const isAdopted = adopted.has(p.id);
              const failed = p.status === "fail";
              const partial = p.status === "warn";
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
                      <button
                        type="button"
                        className="btn-icon-circular"
                        aria-label="다시 생성"
                        disabled
                        aria-describedby={`card-${p.id}-v2note`}
                      >
                        <span aria-hidden="true">↻</span>
                      </button>
                      <button
                        type="button"
                        className="btn-icon-circular"
                        aria-label="수정"
                        disabled
                        aria-describedby={`card-${p.id}-v2note`}
                      >
                        <span aria-hidden="true">✎</span>
                      </button>
                      <button
                        type="button"
                        className="btn-icon-circular"
                        aria-label="폐기"
                        disabled
                        aria-describedby={`card-${p.id}-v2note`}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                      <span
                        id={`card-${p.id}-v2note`}
                        className="sr-only"
                      >
                        v2 에서 도입 예정 — 1차 MVP 에서는 비활성.
                      </span>
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

                  <div className="card-body">
                    <div className="formula-stage">
                      <LatexRenderer
                        latex={p.questionLatex}
                        block
                      />
                    </div>
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
