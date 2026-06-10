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
  const summaryText = step.summary ?? defaultSummary(step.status);
  return (
    <li
      className={`step-progress-row ${step.status}`}
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
  const showPreview = stream.previewLatex !== null;

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
          생성과 검증을 6 단계로 진행합니다. 보통 5 ~ 30 초 걸려요.
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
