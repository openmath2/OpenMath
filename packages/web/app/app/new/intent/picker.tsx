"use client";

import Link from "next/link";
import { useState } from "react";
import {
  type EvaluationCandidate,
  type Grade,
  type Topic,
  gradeLabel,
} from "../topic/data";

type IsomorphismMode = "structural" | "conceptual";

type ModeOption = {
  value: IsomorphismMode;
  label: string;
  desc: string;
  badgeClass: "badge-pass" | "badge-concept";
  badgeIcon: string;
  badgeText: string;
};

const modes: ModeOption[] = [
  {
    value: "structural",
    label: "구조 동형",
    desc: "숫자 · 계수만 바꿔서 원본과 같은 풀이 경로를 따릅니다.",
    badgeClass: "badge-pass",
    badgeIcon: "✓",
    badgeText: "Structural",
  },
  {
    value: "conceptual",
    label: "개념 동형",
    desc: "풀이 경로는 달라도 같은 학습 목표와 평가 차원을 보존합니다.",
    badgeClass: "badge-concept",
    badgeIcon: "✦",
    badgeText: "Conceptual",
  },
];

type Props = {
  grade: Grade | null;
  topic: Topic | null;
  candidates: EvaluationCandidate[];
};

export function IntentPicker({ grade, topic, candidates }: Props) {
  const [mode, setMode] = useState<IsomorphismMode | null>(null);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(candidates.filter((c) => c.default).map((c) => c.key)),
  );

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
            의도를 결정하기 전에 학년과 단원을 먼저 선택해 주세요.
          </p>
          <Link href="/app/new/grade" className="btn btn-primary">
            <span>학년 선택으로</span>
            <span aria-hidden="true">→</span>
          </Link>
        </main>
      </>
    );
  }

  const toggle = (key: string): void => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const canSubmit = mode !== null && checked.size > 0;
  const dims = Array.from(checked).sort().join(",");
  const generateHref = canSubmit
    ? `/app/new/verify?grade=${grade}&topic=${encodeURIComponent(topic.code)}&mode=${mode}&dims=${dims}`
    : null;

  return (
    <>
      <nav className="container-app sub-nav" aria-label="단계 이동">
        <div>
          <Link
            href={`/app/new/topic?grade=${grade}`}
            className="crumb"
          >
            <span aria-hidden="true">←</span>
            <span>단원 선택</span>
          </Link>
          <span className="crumb-sep" aria-hidden="true">·</span>
          <span className="crumb-current">
            {gradeLabel(grade)} · {topic.name}
          </span>
        </div>
        <span className="progress" aria-label="4 단계 중 3 단계">
          (3/4) 의도 확인
        </span>
      </nav>

      <main className="container-app page-body">
        <h1 className="page-title" id="page-title">
          어떻게 출제할까요?
        </h1>
        <p className="page-subtitle">
          동형 방식과 보존할 평가 차원을 골라 주세요. 검증 6 단계가 이
          기준을 따라 진행됩니다.
        </p>

        {/* S3-A — 동형 모드 */}
        <section
          className="section-block"
          aria-labelledby="mode-heading"
        >
          <h2 className="heading-md" id="mode-heading">
            어떤 동형으로 생성할까요?
          </h2>
          <div
            className="mode-grid"
            role="radiogroup"
            aria-labelledby="mode-heading"
          >
            {modes.map((m) => (
              <label key={m.value} className="intent-radio-card">
                <input
                  type="radio"
                  name="iso-mode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                  className="sr-only"
                />
                <span className="dot" aria-hidden="true" />
                <span className="label">
                  <span className="label-main">
                    <span>{m.label}</span>
                    <span className={`badge ${m.badgeClass}`}>
                      <span aria-hidden="true">{m.badgeIcon}</span>
                      <span>{m.badgeText}</span>
                    </span>
                  </span>
                  <span className="label-desc">{m.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* S3-B — 평가 차원 */}
        <section
          className="section-block"
          aria-labelledby="dim-heading"
        >
          <h2 className="heading-md" id="dim-heading">
            보존해야 하는 능력은?
          </h2>

          <div className="inline-notice inline-notice-warn" role="note">
            <span className="icon" aria-hidden="true">
              ⚠
            </span>
            <span className="body">
              이 차원을 보존해야 동형으로 인정됩니다. 1 개 이상
              선택하세요.
            </span>
          </div>

          <fieldset
            className="dimension-list"
            aria-required="true"
            aria-describedby={
              checked.size === 0 ? "dim-required-reason" : undefined
            }
          >
            <legend className="sr-only">평가 차원 (1 개 이상)</legend>
            {candidates.map((c) => (
              <label key={c.key} className="intent-checkbox">
                <input
                  type="checkbox"
                  name="dims"
                  value={c.key}
                  checked={checked.has(c.key)}
                  onChange={() => toggle(c.key)}
                  className="sr-only"
                />
                <span className="check-icon" aria-hidden="true" />
                <span className="label">
                  <span className="label-key" aria-hidden="true">
                    [{c.key}]
                  </span>
                  <span className="label-text">{c.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <span id="dim-required-reason" className="sr-only">
            평가 차원을 1 개 이상 선택하세요.
          </span>
        </section>
      </main>

      <div className="action-bar-sticky">
        <div className="container-app action-bar-inner">
          <div className="left">
            <Link
              href={`/app/new/topic?grade=${grade}`}
              className="btn btn-secondary"
            >
              <span aria-hidden="true">←</span>
              <span>뒤로</span>
            </Link>
          </div>
          <div className="right">
            {generateHref !== null ? (
              <Link href={generateHref} className="btn btn-primary">
                <span>생성하기</span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled
                aria-describedby="generate-reason"
              >
                <span>생성하기</span>
                <span aria-hidden="true">→</span>
              </button>
            )}
            <span id="generate-reason" className="sr-only">
              {mode === null && checked.size === 0
                ? "동형 모드를 선택하고 평가 차원을 1 개 이상 선택하세요."
                : mode === null
                  ? "동형 모드를 선택하세요."
                  : "평가 차원을 1 개 이상 선택하세요."}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
