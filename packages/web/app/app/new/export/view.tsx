"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { LatexAuto } from "@/components/math/latex-renderer";
import { type Grade, type SchoolLevel, type Topic, gradeLabel } from "../topic/data";
import { verificationStorageKey } from "@/lib/verification-storage-key";
import {
  CHOICE_MARKERS,
  answerChoiceIndex,
  splitChoices,
} from "@/lib/exam-choices";
import type { ResultProblem } from "../result/types";

function buildDefaultTitle(
  schoolLevel: SchoolLevel,
  grade: Grade | null,
  topic: Topic | null,
): string {
  if (topic === null) return "";
  return `${gradeLabel(grade, schoolLevel)} ${topic.name} 보강`;
}

type Props = {
  schoolLevel: SchoolLevel;
  grade: Grade | null;
  topic: Topic | null;
  mode: "structural" | "conceptual" | null;
  sourceItemId: string;
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

function resultHref(
  schoolLevel: SchoolLevel,
  grade: Grade | null,
  topic: Topic,
  mode: "structural" | "conceptual" | null,
  sourceItemId: string,
): string {
  const params = new URLSearchParams({
    grade: grade === null ? "common" : String(grade),
    school: schoolLevel,
    topic: topic.code,
  });
  if (mode !== null) params.set("mode", mode);
  if (sourceItemId.length > 0) params.set("srcRef", sourceItemId);
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
  };
}

/* ─────────────────────────────────────────────────────────────
 * ExamSheet — 한국 시험지 표준 조판.
 *   1면: 제목 박스(과목 라벨 + 제목 + 발행 정보) → 인적사항 표
 *        → 2단 컬럼(가운데 괘선) 문항. 객관식은 ①~⑤ 보기를 분리 조판.
 *   별지: "빠른 정답" 표 (인쇄 시 새 페이지).
 * preview / print 가 같은 마크업·px 스타일을 공유한다 — 미리보기는
 * ScaledSheet 가 축소만 하고, 인쇄는 @page 마진 안에 1:1 로 흐른다.
 * ──────────────────────────────────────────────────────────── */

/* 보기 5개가 길면 한 줄 배치가 깨지므로 세로 스택으로 전환 */
const CHOICE_STACK_THRESHOLD = 40;

type AnswerEntry = {
  id: string;
  label: number;
  /* 보기와 일치하면 ①~⑤ 마커, 아니면 원본 정답 문자열 */
  marker: string | null;
  raw: string;
};

function answerEntries(problems: ResultProblem[]): AnswerEntry[] {
  return problems.map((p, i) => {
    const { choices } = splitChoices(p.questionLatex);
    const idx = choices === null ? null : answerChoiceIndex(p.answerLatex, choices);
    return {
      id: p.id,
      label: i + 1,
      marker: idx === null ? null : (CHOICE_MARKERS[idx] ?? null),
      raw: p.answerLatex,
    };
  });
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function ExamProblem({ problem, label }: { problem: ResultProblem; label: number }) {
  const { body, choices } = splitChoices(problem.questionLatex);
  const stacked =
    choices !== null && choices.join("").length > CHOICE_STACK_THRESHOLD;
  return (
    <li className="exam-q">
      <p className="exam-q-text">
        <span className="exam-q-num">{label}.</span>{" "}
        <LatexAuto source={body} />
      </p>
      {choices !== null ? (
        <ol className={stacked ? "exam-choices stacked" : "exam-choices"}>
          {choices.map((choice, k) => (
            <li key={k}>
              <span className="exam-choice-marker" aria-hidden="true">
                {CHOICE_MARKERS[k]}
              </span>
              <span className="exam-choice-body">
                <LatexAuto source={choice} />
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

/* 빠른 정답 — 한 줄 5문항씩, 문항 행(음영) + 정답 행 반복.
 * 마지막 줄은 빈 칸으로 채워 격자를 고르게 유지한다.
 */
const ANSWERS_PER_ROW = 5;

function AnswerTable({ entries }: { entries: AnswerEntry[] }) {
  const rows = chunk(entries, ANSWERS_PER_ROW);
  return (
    <table className="exam-answers-table">
      <tbody>
        {rows.map((row, ri) => {
          const pad = Array.from({ length: ANSWERS_PER_ROW - row.length });
          return (
            <Fragment key={ri}>
              <tr className="num-row">
                {row.map((e) => (
                  <th key={e.id} scope="col">
                    {e.label}
                  </th>
                ))}
                {pad.map((_, k) => (
                  <th key={`pad-${k}`} aria-hidden="true" />
                ))}
              </tr>
              <tr className="ans-row">
                {row.map((e) => (
                  <td key={e.id}>
                    {e.marker !== null ? e.marker : <LatexAuto source={e.raw} />}
                  </td>
                ))}
                {pad.map((_, k) => (
                  <td key={`pad-${k}`} aria-hidden="true" />
                ))}
              </tr>
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function ExamSheet({
  options,
  problems,
  date,
  subject,
}: {
  options: Options;
  problems: ResultProblem[];
  date: string;
  subject: string;
}) {
  const title = options.title.length > 0 ? options.title : "수학 시험지";
  const issueParts: string[] = [];
  if (options.showDate && date.length > 0) issueParts.push(date);
  issueParts.push(`총 ${problems.length}문항`);
  return (
    <article className="exam-sheet">
      <section className="exam-page">
        <header className="exam-head">
          <div className="exam-head-box">
            <p className="exam-subject">{subject}</p>
            <h2 className="exam-title">{title}</h2>
            <p className="exam-issue">{issueParts.join("  ·  ")}</p>
          </div>
          <div className="exam-id-row" aria-label="인적사항 기입란">
            <span className="label">학년 · 반</span>
            <span className="blank" />
            <span className="label">번호</span>
            <span className="blank" />
            <span className="label">이름</span>
            <span className="blank wide" />
            <span className="label">점수</span>
            <span className="blank" />
          </div>
        </header>
        <ol className="exam-cols">
          {problems.map((p, i) => (
            <ExamProblem key={p.id} problem={p} label={i + 1} />
          ))}
        </ol>
      </section>
      {options.includeAnswers && problems.length > 0 ? (
        <section className="exam-page exam-answer-page">
          <h3 className="exam-answers-title">빠른 정답</h3>
          <p className="exam-answers-sub">{title}</p>
          <AnswerTable entries={answerEntries(problems)} />
        </section>
      ) : null}
    </article>
  );
}

/* ─── ScaledSheet — A4(794px) 시트를 미리보기 폭에 맞춰 축소 ───
 * transform: scale 은 레이아웃 높이에 반영되지 않으므로 실측 높이에
 * 배율을 곱해 wrapper 높이를 고정한다.
 */
const A4_WIDTH_PX = 794;

function ScaledSheet({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(0.6);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const update = (): void => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (outer === null || inner === null) return;
      const next = Math.min(1, outer.clientWidth / A4_WIDTH_PX);
      setScale(next);
      setHeight(inner.offsetHeight * next);
    };
    update();
    const observer = new ResizeObserver(update);
    if (outerRef.current !== null) observer.observe(outerRef.current);
    if (innerRef.current !== null) observer.observe(innerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className="sheet-scaler"
      style={height === null ? undefined : { height: `${height}px` }}
    >
      <div
        ref={innerRef}
        className="sheet-scaler-inner"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

export function ExportView({
  schoolLevel,
  grade,
  topic,
  mode,
  sourceItemId,
  adoptedIds,
  problems,
}: Props) {
  const [displayProblems, setDisplayProblems] = useState<ResultProblem[]>(problems);
  const [options, setOptions] = useState<Options>(() => ({
    title: buildDefaultTitle(schoolLevel, grade, topic),
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
      console.warn("[export] sessionStorage read failed:", err);
      return;
    }
    if (raw === null) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn("[export] JSON parse failed:", err);
      return;
    }
    if (!Array.isArray(parsed)) return;
    const stored = parsed.map(parseStoredProblem);
    if (stored.some((p) => p === null)) return;
    const mapped = stored.map((p, index) => toResultProblem(p as StoredProblem, index));
    setDisplayProblems(mapped.filter((p) => adoptedIds.includes(p.id)));
  }, [grade, topic, mode, sourceItemId, adoptedIds, problems, schoolLevel]);

  /* afterprint — 사용자가 시스템 print dialog 를 닫은 시점.
   * 저장/취소 여부는 브라우저 API 가 노출하지 않으므로 일괄 "완료" 로 표기.
   * 인쇄 동안 document.title 을 시험지 제목으로 바꿔 PDF 파일명으로 쓰고,
   * 끝나면 원래 탭 제목으로 되돌린다.
   */
  const tabTitleRef = useRef<string | null>(null);
  useEffect(() => {
    const onAfterPrint = (): void => {
      if (tabTitleRef.current !== null) {
        document.title = tabTitleRef.current;
        tabTitleRef.current = null;
      }
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

  if ((schoolLevel === "middle" && grade === null) || topic === null) {
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
    const backHref = resultHref(schoolLevel, grade, topic, mode, sourceItemId);
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
    /* 브라우저 print API — 시스템 dialog 에서 "PDF 로 저장" 선택.
     * 저장 파일명은 document.title 을 따르므로 잠시 시험지 제목으로 교체.
     */
    const fileTitle = options.title.trim();
    if (fileTitle.length > 0) {
      tabTitleRef.current = document.title;
      document.title = fileTitle;
    }
    window.print();
  };
  const backHref = resultHref(schoolLevel, grade, topic, mode, sourceItemId);
  const examSubject = `${gradeLabel(grade, schoolLevel)} · ${topic.name}`;

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
          {gradeLabel(grade, schoolLevel)} · {topic.name} · {displayProblems.length} 문항
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
            <ScaledSheet>
              <ExamSheet
                options={options}
                problems={orderedProblems}
                date={date}
                subject={examSubject}
              />
            </ScaledSheet>
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
          subject={examSubject}
        />
      </div>
    </>
  );
}
