"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LatexRenderer } from "@/components/math/latex-renderer";
import { useDraftStorage } from "@/hooks/use-draft-storage";
import { loadExportProblems } from "@/lib/session-store";
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
  problems: ResultProblem[];
};

/* OM-83/84:
 *  - gradeLabel/classLabel: 시험지 헤더 name-fields 의 "반: ____" 자리에 즉시 반영.
 *    둘 다 빈 문자열이면 기존 빈 양식 ("반: ____") 유지 (강사가 손으로 채울 수 있게).
 *  - fontSize: <article className="exam-sheet" data-font-size="..."> 로 적용.
 *    실제 px 매핑은 globals.css 의 `.exam-sheet[data-font-size="..."]` 셀렉터가
 *    screen + @media print 양쪽에서 동일 값으로 처리.
 */
type FontSize = "small" | "medium" | "large";

type Options = {
  title: string;
  showDate: boolean;
  includeAnswers: boolean;
  shuffle: boolean;
  gradeLabel: string;
  classLabel: string;
  fontSize: FontSize;
};

const FONT_SIZE_LABEL: Record<FontSize, string> = {
  small: "작게",
  medium: "보통",
  large: "크게",
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
    /* OM-84: fontSize 를 data-font-size 속성으로 적용. CSS 측은 globals.css 의
     * `.exam-sheet[data-font-size="..."]` 셀렉터가 screen + @media print 양쪽에서 매칭.
     * (OM-46 의 동적 클래스명 패턴 `.font-${size}` 를 attribute selector 로 교체.) */
    <article className="exam-sheet" data-font-size={options.fontSize}>
      <header className="exam-header">
        <h2>{options.title.length > 0 ? options.title : "수학 시험지"}</h2>
        {options.showDate && date.length > 0 ? (
          <p className="meta">{date}</p>
        ) : null}
        <div className="name-fields">
          <span>이름: __________</span>
          {/* OM-83: 학년·반 입력 옵션 — gradeLabel 있으면 즉시 반영, 없으면 기존 빈 양식. */}
          <span>
            {options.gradeLabel.length > 0
              ? `${options.gradeLabel}학년 ${options.classLabel.length > 0 ? options.classLabel : "__"}반`
              : "반: ____"}
          </span>
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

export function ExportView({ grade, topic, problems: propProblems }: Props) {
  /* OM-42: 실제 채택 문항은 sessionStorage 에서 로드. prop 은 SSR 초기값 (빈 배열).
   * result/view.tsx 의 export Link onClick 가 saveExportProblems 호출 후 navigate. */
  const [problems, setProblems] = useState<ResultProblem[]>(propProblems);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    const loaded = loadExportProblems();
    if (loaded !== null) {
      setProblems(loaded);
    }
    setHydrated(true);
  }, []);

  const [options, setOptions] = useState<Options>(() => ({
    title: buildDefaultTitle(grade, topic),
    showDate: true,
    includeAnswers: true,
    shuffle: false,
    gradeLabel: "",
    classLabel: "",
    fontSize: "medium",
  }));
  const [date, setDate] = useState<string>("");
  const [downloaded, setDownloaded] = useState<boolean>(false);
  const noticeRef = useRef<HTMLDivElement | null>(null);

  /* 날짜는 client side 에서만 계산 (SSR 시 timezone 불일치 회피). */
  useEffect(() => {
    setDate(new Date().toLocaleDateString("ko-KR"));
  }, []);

  const { clearDraft } = useDraftStorage();

  /* afterprint — 사용자가 시스템 print dialog 를 닫은 시점.
   * 저장/취소 여부는 브라우저 API 가 노출하지 않으므로 일괄 "완료" 로 표기.
   *
   * OM-47: PDF 출력 완료 시 draft 정리 → 다음 작업을 위한 빈 워크스페이스.
   * (취소 vs 저장 구분 불가 — 둘 다 의미상 한 사이클 종료로 간주.)
   */
  useEffect(() => {
    const onAfterPrint = (): void => {
      setDownloaded(true);
      clearDraft();
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* shuffle toggle 시점에만 재정렬, 다른 옵션 변경 시 안정. */
  const orderedProblems = useMemo<ResultProblem[]>(() => {
    if (!options.shuffle) return problems;
    return shuffleArray(problems);
  }, [problems, options.shuffle]);

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

  if (problems.length === 0) {
    return (
      <>
        <nav className="container-app sub-nav" aria-label="단계 이동">
          <Link href="/app/new/result" className="crumb">
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
          <Link href="/app/new/result" className="btn btn-primary">
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

  /* 옵션 변경 핸들러 */
  const setTitle = (v: string): void =>
    setOptions((o) => ({ ...o, title: v }));
  const setShowDate = (v: boolean): void =>
    setOptions((o) => ({ ...o, showDate: v }));
  const setIncludeAnswers = (v: boolean): void =>
    setOptions((o) => ({ ...o, includeAnswers: v }));
  const setShuffle = (v: boolean): void =>
    setOptions((o) => ({ ...o, shuffle: v }));
  /* OM-83 후속 (sprint-5-followups 부록): 학년·반 input 은 inputMode="numeric" 이지만
   * type="text" 라 한글/특수문자 입력 가능. "삼학년" 또는 "3반-A" 같은 비숫자 값이
   * 시험지 헤더에 그대로 출력돼 어색한 결과 ("삼학년 학년 ___반"). onChange 단계에서
   * 숫자만 허용 — 빈 문자열은 그대로 유지 (clear 동작 보존). */
  const digitsOnly = (v: string): string => v.replace(/\D/g, "");
  const setGradeLabel = (v: string): void =>
    setOptions((o) => ({ ...o, gradeLabel: digitsOnly(v) }));
  const setClassLabel = (v: string): void =>
    setOptions((o) => ({ ...o, classLabel: digitsOnly(v) }));
  const setFontSize = (v: FontSize): void =>
    setOptions((o) => ({ ...o, fontSize: v }));

  return (
    <>
      <nav className="container-app sub-nav" aria-label="단계 이동">
        <div>
          <Link href="/app/new/result" className="crumb">
            <span aria-hidden="true">←</span>
            <span>결과</span>
          </Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current">PDF 출력</span>
        </div>
        <span className="progress" aria-hidden="true">
          {gradeLabel(grade)} · {topic.name} · {problems.length} 문항
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

            {/* OM-83: 학년·반 — 시험지 헤더 name-fields 의 "반: ____" 자리에 즉시 반영 */}
            <details className="disclosure-row">
              <summary>
                <span className="option-row-label">학년·반</span>
                <span className="option-value-preview">
                  {options.gradeLabel.length > 0
                    ? `${options.gradeLabel}학년 ${options.classLabel.length > 0 ? options.classLabel : "__"}반`
                    : "(빈 양식)"}
                </span>
                <span className="chevron" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <div
                className="option-input"
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <label
                    htmlFor="opt-grade-label"
                    style={{ flex: 1 }}
                  >
                    <span className="sr-only">학년</span>
                    <input
                      id="opt-grade-label"
                      type="text"
                      value={options.gradeLabel}
                      onChange={(e) => setGradeLabel(e.target.value)}
                      placeholder="학년 (예: 3)"
                      inputMode="numeric"
                      maxLength={6}
                      style={{ width: "100%" }}
                    />
                  </label>
                  <label
                    htmlFor="opt-class-label"
                    style={{ flex: 1 }}
                  >
                    <span className="sr-only">반</span>
                    <input
                      id="opt-class-label"
                      type="text"
                      value={options.classLabel}
                      onChange={(e) => setClassLabel(e.target.value)}
                      placeholder="반 (예: 2)"
                      inputMode="numeric"
                      maxLength={6}
                      style={{ width: "100%" }}
                    />
                  </label>
                </div>
                <p className="option-hint">
                  둘 다 비워두면 시험지의 &quot;반: ____&quot; 빈 양식이
                  그대로 출력됩니다 (강사가 손으로 채울 수 있음).
                </p>
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

            {/* OM-46: 글자 크기 — 토글 버튼 그룹 (medium 기본 강조), 미리보기 + print 양쪽 반영 */}
            <details className="disclosure-row">
              <summary>
                <span className="option-row-label">글자 크기</span>
                <span className="option-value-preview">
                  {FONT_SIZE_LABEL[options.fontSize]}
                </span>
                <span className="chevron" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <div className="option-input">
                <div
                  role="group"
                  aria-label="글자 크기"
                  style={{ display: "flex", gap: 8 }}
                >
                  {(["small", "medium", "large"] as const).map((size) => {
                    const active = options.fontSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        className={
                          active ? "btn btn-ink" : "btn btn-secondary"
                        }
                        aria-pressed={active}
                        onClick={() => setFontSize(size)}
                        style={{ flex: 1 }}
                      >
                        <span>{FONT_SIZE_LABEL[size]}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="option-hint">
                  미리보기 + 인쇄 양쪽에 반영됩니다 (small 14px / medium 16px /
                  large 18px).
                </p>
              </div>
            </details>
          </div>
        </div>
      </main>

      <div className="action-bar-sticky">
        <div className="container-app action-bar-inner">
          <div className="left">
            <Link href="/app/new/result" className="btn btn-secondary">
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

      {/* 인쇄 전용 풀-페이지. @media print 에서만 visible.
          OM-84: data-font-size 매핑은 globals.css 의 [data-font-size="..."] 셀렉터가
          screen + print 양쪽에서 처리 — 별도 inline <style> 불필요. */}
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
