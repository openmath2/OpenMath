"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { LatexRenderer } from "@/components/math/latex-renderer";
import {
  generatedToResult,
  saveResultProblems,
} from "@/lib/session-store";
import {
  type Grade,
  type Topic,
  gradeLabel,
} from "../topic/data";
import {
  type Step,
  type StreamInput,
  useVerificationStream,
} from "@/hooks/use-verification-stream";

type Props = {
  grade: Grade | null;
  topic: Topic | null;
  mode: "structural" | "conceptual" | null;
  dims: string[];
  /* OM-48: S3 에서 사용자가 직접 선택 (default 보장). */
  difficulty: "easy" | "medium" | "hard";
  problemType: "objective" | "short_answer";
};

const STATUS_ICON: Record<Step["status"], string> = {
  pending: "·",
  active: "",
  pass: "✓",
  fail: "✗",
};

function StepIcon({ step }: { step: Step }) {
  if (step.status === "active") {
    return <span className="spinner-dot" aria-hidden="true" />;
  }
  return (
    <span aria-hidden="true" className="status-icon-glyph">
      {STATUS_ICON[step.status]}
    </span>
  );
}

function StepRow({ step }: { step: Step }) {
  /* OM-39: summary === null 이면 텍스트 표시 안 함.
   * 이전 구현은 status 기반 fallback ("통과"/"실패"/"진행 중…") 을 출력해서,
   * 실제 데이터와 어긋난 라벨이 잔존하는 케이스가 있었다 (예: fail 행에 이전 pass summary).
   * 이제는 step.summary 가 있을 때만 표시하고, 상태는 색·아이콘으로만 전달한다.
   */
  const hasSummary = step.summary !== null;
  return (
    <li
      className={`step-progress-row ${step.status}`}
      aria-label={`${step.index}/6 ${step.name} — ${stateLabel(step.status)}${
        hasSummary ? `, ${step.summary}` : ""
      }`}
    >
      <span className="index" aria-hidden="true">
        {step.index}/6
      </span>
      <span className="name">{step.name}</span>
      {hasSummary ? (
        <span className="summary" aria-hidden="true">
          {step.summary}
        </span>
      ) : null}
      <span className="status-icon">
        <StepIcon step={step} />
      </span>
    </li>
  );
}

function stateLabel(status: Step["status"]): string {
  switch (status) {
    case "pending":
      return "대기";
    case "active":
      return "진행 중";
    case "pass":
      return "통과";
    case "fail":
      return "실패";
  }
}

export function VerifyView({
  grade,
  topic,
  mode,
  dims,
  difficulty,
  problemType,
}: Props) {
  const valid =
    grade !== null && topic !== null && mode !== null && dims.length > 0;

  const input: StreamInput | null = useMemo(() => {
    if (!valid || grade === null || topic === null || mode === null) {
      return null;
    }
    /* OM-48: difficulty / problem_type 도 stream input 으로 전달 */
    return {
      grade,
      topic: topic.code,
      mode,
      dims,
      difficulty,
      problemType,
    };
  }, [valid, grade, topic, mode, dims, difficulty, problemType]);

  /* hook 은 input 이 null 이면 stream 을 시작하지 않는다. invalid 가드. */
  const stream = useVerificationStream(input);
  const router = useRouter();

  /* OM-80: 검증 6/6 통과 시 S5 로 자동 라우팅.
   *  - "done" 외 (cancelled / error / streaming / idle) 에선 라우팅 안 함
   *  - prefers-reduced-motion 일 땐 즉시 (delay 0), 아니면 600ms 후 (사용자가 6/6 ✓ 를 인지할 여유)
   *  - unmount / status 변경 시 cleanup 으로 timer 취소
   *  - props (grade/topic/mode/dims) 가 null 인 edge case 에선 라우팅 안 함 (위 valid 가드 후엔 사실상 발생 X)
   */
  useEffect(() => {
    if (stream.status !== "done") return;
    if (grade === null || topic === null || mode === null) return;

    /* OM-42: navigation 전에 검증된 candidates 를 ResultProblem 으로 매핑해
     *  sessionStorage 에 저장. result/export 화면이 이 데이터를 읽음. */
    const resultProblems = stream.candidates.map(generatedToResult);
    saveResultProblems(resultProblems);

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const delay = prefersReduced ? 0 : 600;
    const url = `/app/new/result?grade=${grade}&topic=${encodeURIComponent(topic.code)}&mode=${mode}&dims=${dims.join(",")}`;
    const timer = setTimeout(() => {
      router.push(url);
    }, delay);
    return () => clearTimeout(timer);
  }, [stream.status, stream.candidates, router, grade, topic, mode, dims]);

  if (!valid) {
    return (
      <>
        <nav className="container-app sub-nav" aria-label="단계 이동">
          <Link href="/app/new/intent" className="crumb">
            <span aria-hidden="true">←</span>
            <span>의도 확인</span>
          </Link>
        </nav>
        <main className="container-app page-body">
          <h1 className="page-title">이전 단계 정보가 필요해요</h1>
          <p className="page-subtitle">
            학년 · 단원 · 동형 모드 · 평가 차원 중 하나가 누락되었습니다.
          </p>
          <Link href="/app/new/grade" className="btn btn-primary">
            <span>학년 선택으로</span>
            <span aria-hidden="true">→</span>
          </Link>
        </main>
      </>
    );
  }

  const subnavLabel = `${gradeLabel(grade)} · ${topic.name}`;
  const isError = stream.status === "error";
  const isCancelled = stream.status === "cancelled";
  const isDone = stream.status === "done";
  const showPreview = stream.previewLatex !== null;

  return (
    <>
      <nav className="container-app sub-nav" aria-label="단계 이동">
        <div>
          <Link href="/app/new/intent" className="crumb">
            <span aria-hidden="true">←</span>
            <span>의도 확인</span>
          </Link>
          <span className="crumb-sep" aria-hidden="true">·</span>
          <span className="crumb-current">{subnavLabel}</span>
        </div>
        <span className="progress" aria-label="4 단계 중 4 단계">
          (4/4) 검증 진행
        </span>
      </nav>

      <main className="container-app page-body">
        <h1 className="page-title" id="page-title">
          검증하고 있습니다
        </h1>
        <p className="page-subtitle">
          생성과 검증을 6 단계로 진행합니다. 보통 5 ~ 30 초 걸려요.
        </p>

        {isError && stream.error !== null ? (
          <div className="inline-notice inline-notice-fail" role="alert">
            <span className="icon" aria-hidden="true">
              ✗
            </span>
            <span className="body">{stream.error}</span>
          </div>
        ) : null}

        {isCancelled ? (
          <div className="inline-notice inline-notice-warn" role="status">
            <span className="icon" aria-hidden="true">
              ⚠
            </span>
            <span className="body">
              검증이 취소되었습니다. 의도를 다시 확인하거나 처음부터
              시작하세요.
            </span>
          </div>
        ) : null}

        {/* OM-43 ②: 검증 완료 안내 + auto-route 진행 표시.
            useEffect 가 600ms 후 router.push 호출하지만, 그 동안 사용자에게 어떤
            일이 일어나는지 가시화 필요 (silent 600ms 는 멍한 경험). prefers-reduced-motion
            일 땐 즉시 이동이라 이 notice 가 짧게만 노출되며, 자동 이동 실패 시
            아래 fallback "결과 보기" 버튼이 보장한다. */}
        {isDone ? (
          <div
            className="inline-notice inline-notice-pass"
            role="status"
            aria-live="polite"
          >
            <span className="icon" aria-hidden="true">
              ✓
            </span>
            <span className="body">
              검증이 완료되었습니다. 잠시 후 자동으로 결과 화면으로 이동합니다.
            </span>
          </div>
        ) : null}

        <ol
          className="step-progress-list"
          aria-label="검증 6 단계"
          aria-live="polite"
          aria-atomic="false"
        >
          {stream.steps.map((step) => (
            <StepRow key={step.index} step={step} />
          ))}
        </ol>

        {/* OM-43 ①: BE 가 3/6 generate 직후 emit 한 preview 이벤트의 latex 를 렌더.
            6/6 완료 후에도 유지 (auto-route 600ms 동안 사용자가 미리보기 확인 가능). */}
        {showPreview && stream.previewLatex !== null ? (
          <div className="formula-stage-wrap">
            <div className="formula-stage">
              <span className="caption">생성된 후보 문제 미리보기</span>
              <LatexRenderer latex={stream.previewLatex} block />
            </div>
          </div>
        ) : null}
      </main>

      <div className="action-bar-sticky">
        <div className="container-app action-bar-inner">
          <div className="left">
            {isError || isCancelled ? (
              <Link href="/app/new/intent" className="btn btn-secondary">
                <span aria-hidden="true">←</span>
                <span>의도 확인으로</span>
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={stream.cancel}
                disabled={isDone}
              >
                <span>취소</span>
              </button>
            )}
          </div>
          <div className="right">
            {isError || isCancelled ? (
              <Link
                href={`/app/new/verify?grade=${grade}&topic=${encodeURIComponent(topic.code)}&mode=${mode}&dims=${dims.join(",")}`}
                className="btn btn-primary"
                prefetch={false}
                replace
              >
                <span>다시 시작</span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : isDone ? (
              /* OM-43 ②: auto-route fallback.
                 useEffect 의 router.push 가 (네트워크 오류 / blocked navigation 등으로)
                 실패해도 사용자가 수동으로 진입할 경로 보장. 정상 동작 시엔 600ms 안에
                 router.push 가 먼저 일어나 본 Link 는 거의 보이지 않는다. */
              <Link
                href={`/app/new/result?grade=${grade}&topic=${encodeURIComponent(topic.code)}&mode=${mode}&dims=${dims.join(",")}`}
                className="btn btn-primary"
              >
                <span>결과 보기</span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
