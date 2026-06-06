"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LatexRenderer } from "@/components/math/latex-renderer";
import { type Grade, type Topic, gradeLabel } from "../topic/data";
import type { ResultProblem } from "../result/mock";

function buildDefaultTitle(
  grade: Grade | null,
  topic: Topic | null,
): string {
  if (grade === null || topic === null) return "";
  return `${gradeLabel(grade)} ${topic.name} 보강`;
}

type Props = {
  grade: Grade | null;
  topic: Topic | null;
  mode: "structural" | "conceptual" | null;
  dims: string[];
  sourceProblemText: string;
  adoptedIds: string[];
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

type Options = {
  title: string;
  showDate: boolean;
  includeAnswers: boolean;
  shuffle: boolean;
};

/* Fisher-Yates 셔플. shuffle 토글 시 한 번만 재계산. */
function shuffleArray<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    const swap = out[j];
    if (tmp === undefined || swap === undefined) continue;
    out[i] = swap;
    out[j] = tmp;
  }
  return out;
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

function resultHref(
  grade: Grade,
  topic: Topic,
  mode: "structural" | "conceptual" | null,
  dims: readonly string[],
  sourceProblemText: string,
): string {
  const params = new URLSearchParams({
    grade: String(grade),
    topic: topic.code,
  });
  if (mode !== null) params.set("mode", mode);
  if (dims.length > 0) params.set("dims", [...dims].join(","));
  if (sourceProblemText.length > 0) params.set("source", sourceProblemText);
  return `/app/new/result?${params.toString()}`;
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

function ExamSheet({
  options,
  problems,
  date,
}: {
  options: Options;
  problems: ResultProblem[];
  date: string;
}) {
  return (
    <article className="exam-sheet">
      <header className="exam-header">
        <h2>{options.title.length > 0 ? options.title : "수학 시험지"}</h2>
        {options.showDate && date.length > 0 ? (
          <p className="meta">{date}</p>
        ) : null}
        <div className="name-fields">
          <span>이름: __________</span>
          <span>반: ____</span>
          <span>번호: ____</span>
        </div>
      </header>
      <ol className="exam-problems">
        {problems.map((p, i) => (
          <li key={p.id} className="exam-problem">
            <span className="num">{i + 1}.</span>
            <span className="body">
              <LatexRenderer latex={p.questionLatex} />
            </span>
          </li>
        ))}
      </ol>
      {options.includeAnswers && problems.length > 0 ? (
        <section className="exam-answers">
          <h3>정답</h3>
          <ol>
            {problems.map((p, i) => (
              <li key={p.id}>
                <span>{i + 1}. </span>
                <LatexRenderer latex={p.answerLatex} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}

export function ExportView({
  grade,
  topic,
  mode,
  dims,
  sourceProblemText,
  adoptedIds,
  problems,
}: Props) {
  const [displayProblems, setDisplayProblems] = useState<ResultProblem[]>(problems);
  const [options, setOptions] = useState<Options>(() => ({
    title: buildDefaultTitle(grade, topic),
    showDate: true,
    includeAnswers: true,
    shuffle: false,
  }));
  const [date, setDate] = useState<string>("");
  const [downloaded, setDownloaded] = useState<boolean>(false);
  const noticeRef = useRef<HTMLDivElement | null>(null);

  /* 날짜는 client side 에서만 계산 (SSR 시 timezone 불일치 회피). */
  useEffect(() => {
    setDate(new Date().toLocaleDateString("ko-KR"));
  }, []);

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
      const mapped = stored.map((p, index) => toResultProblem(p as StoredProblem, index, dims));
      setDisplayProblems(mapped.filter((p) => adoptedIds.includes(p.id)));
    } catch {
      setDisplayProblems(problems);
    }
  }, [grade, topic, mode, dims, sourceProblemText, adoptedIds, problems]);

  /* afterprint — 사용자가 시스템 print dialog 를 닫은 시점.
   * 저장/취소 여부는 브라우저 API 가 노출하지 않으므로 일괄 "완료" 로 표기.
   */
  useEffect(() => {
    const onAfterPrint = (): void => {
      setDownloaded(true);
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  /* shuffle toggle 시점에만 재정렬, 다른 옵션 변경 시 안정. */
  const orderedProblems = useMemo<ResultProblem[]>(() => {
    if (!options.shuffle) return displayProblems;
    return shuffleArray(displayProblems);
  }, [displayProblems, options.shuffle]);

  if (grade === null || topic === null) {
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
            출력하기 전에 학년 · 단원을 먼저 선택해 주세요.
          </p>
          <Link href="/app/new/grade" className="btn btn-primary">
            <span>학년 선택으로</span>
            <span aria-hidden="true">→</span>
          </Link>
        </main>
      </>
    );
  }

  if (displayProblems.length === 0) {
    const backHref = resultHref(grade, topic, mode, dims, sourceProblemText);
    return (
      <>
        <nav className="container-app sub-nav" aria-label="단계 이동">
          <Link href={backHref} className="crumb">
            <span aria-hidden="true">←</span>
            <span>결과</span>
          </Link>
        </nav>
        <main className="container-app page-body">
          <h1 className="page-title">채택된 문항이 없어요</h1>
          <p className="page-subtitle">
            결과 화면에서 ★ 별표로 문항을 채택한 뒤 다시
            오세요.
          </p>
          <Link href={backHref} className="btn btn-primary">
            <span>결과로 돌아가기</span>
            <span aria-hidden="true">→</span>
          </Link>
        </main>
      </>
    );
  }

  const onDownload = (): void => {
    setDownloaded(false);
    /* 브라우저 print API — 시스템 dialog 에서 "PDF 로 저장" 선택. */
    window.print();
  };
  const backHref = resultHref(grade, topic, mode, dims, sourceProblemText);

  /* 옵션 변경 핸들러 */
  const setTitle = (v: string): void =>
    setOptions((o) => ({ ...o, title: v }));
  const setShowDate = (v: boolean): void =>
    setOptions((o) => ({ ...o, showDate: v }));
  const setIncludeAnswers = (v: boolean): void =>
    setOptions((o) => ({ ...o, includeAnswers: v }));
  const setShuffle = (v: boolean): void =>
    setOptions((o) => ({ ...o, shuffle: v }));

  return (
    <>
      <nav className="container-app sub-nav" aria-label="단계 이동">
        <div>
          <Link href={backHref} className="crumb">
            <span aria-hidden="true">←</span>
            <span>결과</span>
          </Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current">PDF 출력</span>
        </div>
        <span className="progress" aria-hidden="true">
          {gradeLabel(grade)} · {topic.name} · {displayProblems.length} 문항
        </span>
      </nav>

      <main className="container-app page-body">
        <h1 className="page-title" id="page-title">
          시험지 미리보기
        </h1>
        <p className="page-subtitle">
          오른쪽에서 옵션을 조정한 뒤 [PDF 다운로드 ↓] 를 누르세요.
          브라우저의 인쇄 화면이 열리고, &ldquo;PDF 로 저장&rdquo; 을
          선택하면 파일이 다운로드됩니다.
        </p>

        {downloaded ? (
          <div
            className="inline-notice inline-notice-pass"
            role="status"
            ref={noticeRef}
          >
            <span className="icon" aria-hidden="true">
              ✓
            </span>
            <span className="body">
              인쇄 작업이 종료되었습니다. PDF 를 저장했다면 브라우저의
              다운로드 폴더에서 파일을 확인할 수 있습니다.
            </span>
          </div>
        ) : null}

        <div className="export-layout">
          <div className="pdf-preview-thumbnail">
            <ExamSheet
              options={options}
              problems={orderedProblems}
              date={date}
            />
          </div>

          <div className="options-pane" aria-label="시험지 옵션">
            {/* 제목 */}
            <details className="disclosure-row" open>
              <summary>
                <span className="option-row-label">제목</span>
                <span className="option-value-preview">
                  {options.title.length > 0 ? options.title : "(없음)"}
                </span>
                <span className="chevron" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <div className="option-input">
                <label htmlFor="opt-title" className="sr-only">
                  시험지 제목
                </label>
                <input
                  id="opt-title"
                  type="text"
                  value={options.title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 중1 일차방정식 보강"
                  maxLength={60}
                />
                <p className="option-hint">파일명에도 사용됩니다.</p>
              </div>
            </details>

            {/* 날짜 표시 */}
            <details className="disclosure-row">
              <summary>
                <span className="option-row-label">날짜 표시</span>
                <span className="option-value-preview">
                  {options.showDate ? `예 · ${date}` : "아니오"}
                </span>
                <span className="chevron" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <div className="option-input">
                <div className="radio-group" role="radiogroup" aria-label="날짜 표시">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="opt-date"
                      checked={options.showDate}
                      onChange={() => setShowDate(true)}
                    />
                    <span>표시</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="opt-date"
                      checked={!options.showDate}
                      onChange={() => setShowDate(false)}
                    />
                    <span>숨김</span>
                  </label>
                </div>
              </div>
            </details>

            {/* 정답표 포함 */}
            <details className="disclosure-row">
              <summary>
                <span className="option-row-label">정답표 포함</span>
                <span className="option-value-preview">
                  {options.includeAnswers ? "포함" : "미포함"}
                </span>
                <span className="chevron" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <div className="option-input">
                <div
                  className="radio-group"
                  role="radiogroup"
                  aria-label="정답표 포함"
                >
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="opt-answers"
                      checked={options.includeAnswers}
                      onChange={() => setIncludeAnswers(true)}
                    />
                    <span>포함</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="opt-answers"
                      checked={!options.includeAnswers}
                      onChange={() => setIncludeAnswers(false)}
                    />
                    <span>미포함</span>
                  </label>
                </div>
                <p className="option-hint">
                  포함 시 본문 마지막에 별도 섹션으로 출력됩니다.
                </p>
              </div>
            </details>

            {/* 문항 셔플 */}
            <details className="disclosure-row">
              <summary>
                <span className="option-row-label">문항 셔플</span>
                <span className="option-value-preview">
                  {options.shuffle ? "셔플 적용" : "원래 순서"}
                </span>
                <span className="chevron" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <div className="option-input">
                <div
                  className="radio-group"
                  role="radiogroup"
                  aria-label="문항 순서"
                >
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="opt-shuffle"
                      checked={!options.shuffle}
                      onChange={() => setShuffle(false)}
                    />
                    <span>원래 순서</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="opt-shuffle"
                      checked={options.shuffle}
                      onChange={() => setShuffle(true)}
                    />
                    <span>셔플</span>
                  </label>
                </div>
                <p className="option-hint">
                  셔플 시 매 토글마다 새로운 순서가 적용됩니다.
                </p>
              </div>
            </details>
          </div>
        </div>
      </main>

      <div className="action-bar-sticky">
        <div className="container-app action-bar-inner">
          <div className="left">
            <Link href={backHref} className="btn btn-secondary">
              <span aria-hidden="true">←</span>
              <span>결과로</span>
            </Link>
          </div>
          <div className="right">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onDownload}
            >
              <span>PDF 다운로드</span>
              <span aria-hidden="true">↓</span>
            </button>
          </div>
        </div>
      </div>

      {/* 인쇄 전용 풀-페이지. @media print 에서만 visible. */}
      <div className="print-root" aria-hidden="true">
        <ExamSheet
          options={options}
          problems={orderedProblems}
          date={date}
        />
      </div>
    </>
  );
}
