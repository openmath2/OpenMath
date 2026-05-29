"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { LatexRenderer } from "@/components/math/latex-renderer";
import {
  type Grade,
  type Topic,
  gradeLabel,
} from "../topic/data";
import {
  type RagReference,
  type Step,
  type StreamInput,
  useVerificationStream,
} from "@/hooks/use-verification-stream";

type Props = {
  grade: Grade | null;
  topic: Topic | null;
  mode: "structural" | "conceptual" | null;
  dims: string[];
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

function RagReferenceList({ refs }: { refs: RagReference[] }) {
  if (refs.length === 0) {
    return null;
  }

  return (
    <section
      className="section-block"
      aria-labelledby="rag-reference-heading"
    >
      <h2 className="heading-md" id="rag-reference-heading">
        참조한 원본 문제
      </h2>
      <ul className="reference-list" aria-label="RAG 검색 참조 문제">
        {refs.slice(0, 5).map((ref) => (
          <li key={ref.item_id} className="reference-row">
            <span className="reference-topic">{ref.topic_name}</span>
            <span className="reference-meta">
              {ref.item_id}
              {ref.similarity !== null
                ? ` · ${Math.round(ref.similarity * 100)}%`
                : ""}
              {` · ${ref.match_reason}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function VerifyView({ grade, topic, mode, dims }: Props) {
  const valid =
    grade !== null && topic !== null && mode !== null && dims.length > 0;

  const input: StreamInput | null = useMemo(() => {
    if (!valid || grade === null || topic === null || mode === null) {
      return null;
    }
    return { grade, topic: topic.code, topicName: topic.name, mode, dims };
  }, [valid, grade, topic, mode, dims]);

  /* hook 은 input 이 null 이면 stream 을 시작하지 않는다. invalid 가드. */
  const stream = useVerificationStream(input);

  /* 자동 라우팅: status === "done" 시 S5 로 이동.
   * router.push 는 useEffect 없이 호출하면 SSR 단계 미스매치. 일단
   * S5 미구현이므로 inline-notice + 수동 링크로 처리. (다음 PR 에서 router.push)
   */
  const announceRef = useRef<HTMLDivElement | null>(null);

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

        <RagReferenceList refs={stream.ragRefs} />
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
