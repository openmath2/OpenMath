"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LatexRenderer } from "@/components/math/latex-renderer";
import {
  type Grade,
  type SchoolLevel,
  type Topic,
  gradeLabel,
} from "../topic/data";
import {
  type Step,
  type StreamInput,
  useVerificationStream,
} from "@/hooks/use-verification-stream";

type Props = {
  schoolLevel: SchoolLevel;
  grade: Grade | null;
  topic: Topic | null;
  mode: "structural" | "conceptual" | null;
  srcRef: string;
};

type IntentSource = {
  item_id: string;
  question_text: string;
  difficulty_norm: "easy" | "medium" | "hard";
};

const STATUS_ICON: Record<Step["status"], string> = {
  pending: "·",
  active: "",
  pass: "✓",
  fail: "✗",
  unverified: "△",
};

/* unverified 는 디자인 토큰의 warn 변형을 재사용한다 (실패 아님 — 판정 불가). */
function rowClass(status: Step["status"]): string {
  return status === "unverified" ? "warn" : status;
}

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
  const summaryText = step.summary ?? defaultSummary(step.status);
  return (
    <li
      className={`step-progress-row ${rowClass(step.status)}`}
      aria-label={`${step.index}/6 ${step.name} — ${stateLabel(step.status)}${
        summaryText ? `, ${summaryText}` : ""
      }`}
    >
      <span className="index" aria-hidden="true">
        {step.index}/6
      </span>
      <span className="name">{step.name}</span>
      <span className="summary" aria-hidden="true">
        {summaryText}
      </span>
      <span className="status-icon">
        <StepIcon step={step} />
      </span>
    </li>
  );
}

function defaultSummary(status: Step["status"]): string {
  switch (status) {
    case "active":
      return "진행 중…";
    case "pending":
      return "";
    case "pass":
      return "통과";
    case "fail":
      return "실패";
    case "unverified":
      return "기호 검증 불가 — 재풀이로 확인";
  }
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
    case "unverified":
      return "검증 불가";
  }
}

function parseIntentSource(raw: unknown): IntentSource | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.item_id !== "string" || o.item_id.length === 0) return null;
  if (typeof o.question_text !== "string") return null;
  if (
    o.difficulty_norm !== "easy" &&
    o.difficulty_norm !== "medium" &&
    o.difficulty_norm !== "hard"
  ) {
    return null;
  }
  return {
    item_id: o.item_id,
    question_text: o.question_text,
    difficulty_norm: o.difficulty_norm,
  };
}

export function VerifyView({ schoolLevel, grade, topic, mode, srcRef }: Props) {
  const [intentSource, setIntentSource] = useState<IntentSource | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    setHydrated(true);
    if (srcRef.length === 0) return;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem("openmath:intent-source");
    } catch (err) {
      console.warn("[intent-source] sessionStorage read failed:", err);
      return;
    }
    if (raw === null) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn("[intent-source] JSON parse failed:", err);
      return;
    }
    const validated = parseIntentSource(parsed);
    if (validated === null) return;
    if (validated.item_id !== srcRef) return;
    setIntentSource(validated);
  }, [srcRef]);

  const sourceItemId = intentSource?.item_id ?? "";
  const sourceProblemText = intentSource?.question_text ?? "";

  const gateValid =
    (schoolLevel === "high" || grade !== null) &&
    topic !== null &&
    mode !== null &&
    sourceItemId !== "";

  const input: StreamInput | null = useMemo(() => {
    if (!gateValid || topic === null || mode === null) return null;
    return {
      schoolLevel,
      grade,
      topic: topic.code,
      topicName: topic.name,
      mode,
      sourceItemId,
      sourceProblemText,
    };
  }, [gateValid, schoolLevel, grade, topic, mode, sourceItemId, sourceProblemText]);

  const stream = useVerificationStream(input);
  const announceRef = useRef<HTMLDivElement | null>(null);

  if ((schoolLevel === "middle" && grade === null) || topic === null || mode === null) {
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
            학년 · 단원 · 동형 모드 중 하나가 누락되었습니다.
          </p>
          <Link href="/app/new/grade" className="btn btn-primary">
            <span>학년 선택으로</span>
            <span aria-hidden="true">→</span>
          </Link>
        </main>
      </>
    );
  }

  const gradeParam = grade === null ? "common" : String(grade);
  const intentHref = `/app/new/intent?school=${schoolLevel}&grade=${gradeParam}&topic=${encodeURIComponent(topic.code)}`;

  if (hydrated && (srcRef.length === 0 || intentSource === null)) {
    return (
      <>
        <nav className="container-app sub-nav" aria-label="단계 이동">
          <Link href={intentHref} className="crumb">
            <span aria-hidden="true">←</span>
            <span>의도 확인</span>
          </Link>
        </nav>
        <main className="container-app page-body">
          <h1 className="page-title">기준 문항을 다시 선택해 주세요</h1>
          <p className="page-subtitle">
            검증을 시작하려면 의도 확인 화면에서 기준 문항을 1 개 골라야
            합니다. 세션이 만료되었거나 직접 URL 로 접근한 경우 다시
            선택해 주세요.
          </p>
          <Link href={intentHref} className="btn btn-primary">
            <span>의도 확인으로</span>
            <span aria-hidden="true">→</span>
          </Link>
        </main>
      </>
    );
  }

  const subnavLabel = `${gradeLabel(grade, schoolLevel)} · ${topic.name}`;
  const isError = stream.status === "error";
  const isCancelled = stream.status === "cancelled";
  const isDone = stream.status === "done";
  const isStreaming = stream.status === "streaming";
  const showPreview = stream.previewLatex !== null;
  const showAttempt = stream.attempt !== null && isStreaming;
  /* 스텝바(첫 런)는 끝났는데 result가 아직이면 나머지 병렬 런을 기다리는 중. */
  const stepsSettled = stream.steps.every(
    (step) =>
      step.status === "pass" || step.status === "fail" || step.status === "unverified",
  );
  const waitingSiblingRuns =
    isStreaming &&
    stepsSettled &&
    stream.runs !== null &&
    stream.runs.completed < stream.runs.total;

  const verifyHref = `/app/new/verify?school=${schoolLevel}&grade=${gradeParam}&topic=${encodeURIComponent(topic.code)}&mode=${mode}&srcRef=${encodeURIComponent(srcRef)}`;
  const resultHref = `/app/new/result?school=${schoolLevel}&grade=${gradeParam}&topic=${encodeURIComponent(topic.code)}&mode=${mode}&srcRef=${encodeURIComponent(srcRef)}`;

  return (
    <>
      <nav className="container-app sub-nav" aria-label="단계 이동">
        <div>
          <Link href={intentHref} className="crumb">
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
          생성과 검증을 6 단계로 진행합니다. 추론 모델이 직접 풀어보며
          검증하므로 보통 1 ~ 3 분 걸려요.
        </p>

        {isError && stream.error !== null ? (
          <div
            className="inline-notice inline-notice-fail"
            role="alert"
            ref={announceRef}
          >
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

        {isDone ? (
          <div className="inline-notice inline-notice-pass" role="status">
            <span className="icon" aria-hidden="true">
              ✓
            </span>
            <span className="body">
              검증이 완료되었습니다. 결과 화면에서 채택할 문항을
              선택하세요.
            </span>
          </div>
        ) : null}

        {showAttempt && stream.attempt !== null ? (
          <div className="inline-notice inline-notice-warn" role="status">
            <span className="icon" aria-hidden="true">
              ↻
            </span>
            <span className="body">
              시도 {stream.attempt.current}/{stream.attempt.max} — 이전 후보가
              검증을 통과하지 못해 다시 생성합니다.
              {stream.attempt.reason ? ` (${stream.attempt.reason})` : ""}
            </span>
          </div>
        ) : null}

        {waitingSiblingRuns ? (
          <div className="inline-notice inline-notice-warn" role="status">
            <span className="icon" aria-hidden="true">
              …
            </span>
            <span className="body">
              나머지 문항을 검증하고 있어요. 곧 결과가 도착합니다.
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

        {stream.runs !== null && stream.runs.total > 1 ? (
          <p className="runs-progress" role="status">
            문항 {stream.runs.completed}/{stream.runs.total} 생성 완료
          </p>
        ) : null}

        {showPreview && stream.previewLatex !== null ? (
          <div className="formula-stage-wrap">
            <div className="formula-stage">
              <span className="caption">CANDIDATE PREVIEW</span>
              <LatexRenderer latex={stream.previewLatex} block />
            </div>
          </div>
        ) : null}
      </main>

      <div className="action-bar-sticky">
        <div className="container-app action-bar-inner">
          <div className="left">
            {isError || isCancelled ? (
              <Link href={intentHref} className="btn btn-secondary">
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
                href={verifyHref}
                className="btn btn-primary"
                prefetch={false}
                replace
              >
                <span>다시 시작</span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : isDone ? (
              <Link href={resultHref} className="btn btn-primary">
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
