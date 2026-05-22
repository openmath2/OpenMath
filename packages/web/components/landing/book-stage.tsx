"use client";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────────
 * Tablet (iPad) showcase — OpenMath 사용법 4단계 walkthrough.
 * 단일 column 레이아웃으로 overflow 해결. 각 단계마다 step 표시 +
 * 타이틀 + 짧은 설명 + 미니 UI 목업 (학년 / 의도 / 검증 / 결과).
 * 5초마다 fade-in 으로 자동 전환.
 * ──────────────────────────────────────────────────────────── */

type StepKind = "workspace" | "grade" | "topic" | "intent" | "verify";

type Step = {
  number: number;
  label: string;
  title: string;
  desc: string;
  kind: StepKind;
};

const STEPS: Step[] = [
  {
    number: 1,
    label: "워크스페이스",
    title: "검증된 문제 한 세트",
    desc: "학년 → 단원 → 의도 → 검증 → PDF. 다섯 단계 동형 출제.",
    kind: "workspace",
  },
  {
    number: 2,
    label: "학년 선택",
    title: "어느 학년인가요?",
    desc: "이번 출제의 대상 학년을 고르세요.",
    kind: "grade",
  },
  {
    number: 3,
    label: "단원 선택",
    title: "어느 단원인가요?",
    desc: "2022 개정 교육과정의 성취기준 단위로 정렬.",
    kind: "topic",
  },
  {
    number: 4,
    label: "의도 확인",
    title: "어떻게 출제할까요?",
    desc: "동형 모드와 보존할 평가 차원을 선택합니다.",
    kind: "intent",
  },
  {
    number: 5,
    label: "검증 진행",
    title: "검증하고 있습니다",
    desc: "생성과 검증을 6 단계로 진행합니다. 보통 5 ~ 30 초.",
    kind: "verify",
  },
];

export function BookStage() {
  const [stepIdx, setStepIdx] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent): void => setReduceMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* setStepIdx 의 functional updater 만 사용하므로 stepIdx 를 deps 에 넣을
   * 필요가 없다. 넣으면 step 전환마다 timer 가 재생성되어 주기가 어긋난다.
   */
  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setStepIdx((i) => (i + 1) % STEPS.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const goNext = (): void => setStepIdx((i) => (i + 1) % STEPS.length);
  const goPrev = (): void =>
    setStepIdx((i) => (i - 1 + STEPS.length) % STEPS.length);

  const step = STEPS[stepIdx] ?? STEPS[0]!;

  return (
    <div className="book-stage">
      <div className="tablet-frame">
        <div className="tablet-screen">
          {/* Status bar */}
          <div className="tablet-statusbar">
            <span>9:30 AM · 5월 20일</span>
            <span className="tablet-statusbar-right">
              <span>100%</span>
              <span className="tablet-battery" aria-hidden="true" />
            </span>
          </div>

          {/* App nav — brand left, CTA right */}
          <div className="tablet-appnav">
            <div className="tablet-brand">
              <span>OpenMath</span>
            </div>
            <button
              type="button"
              className="tablet-cta-btn"
              onClick={goNext}
              aria-label="다음 단계로"
            >
              <span>문제 생성하기</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>

          {/* Body — single column step walkthrough */}
          <div className="tablet-body">
            <div className="tablet-step" key={stepIdx}>
              <div className="tablet-step-head">
                <span className="tablet-step-label">{step.label}</span>
                <span className="tablet-step-count">
                  <strong>{step.number}</strong>
                  <span>{" "}/ {STEPS.length}</span>
                </span>
              </div>
              <h4 className="tablet-step-title">{step.title}</h4>
              <p className="tablet-step-desc">{step.desc}</p>
              <div className="tablet-step-visual">
                {step.kind === "workspace" ? <MockWorkspace /> : null}
                {step.kind === "grade" ? <MockGrade /> : null}
                {step.kind === "topic" ? <MockTopic /> : null}
                {step.kind === "intent" ? <MockIntent /> : null}
                {step.kind === "verify" ? <MockVerify /> : null}
              </div>
            </div>
          </div>

          {/* Bottom bar — step indicator dots + interactive arrows */}
          <div className="tablet-bottombar">
            <button
              type="button"
              className="tablet-nav-arrow"
              onClick={goPrev}
              aria-label="이전 단계"
            >
              ←
            </button>
            <div className="tablet-dots">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={"tablet-dot" + (i === stepIdx ? " active" : "")}
                />
              ))}
            </div>
            <button
              type="button"
              className="tablet-nav-arrow"
              onClick={goNext}
              aria-label="다음 단계"
            >
              →
            </button>
          </div>

          {/* Home indicator */}
          <div className="tablet-home-indicator" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/* ───────── Step visuals ───────── */

/* S0 — Workspace */
function MockWorkspace() {
  return (
    <div className="mock-ws">
      <div className="mock-ws-hero">
        <span className="mock-ws-title">검증된 문제 한 세트.</span>
      </div>
      <div className="mock-ws-grid">
        <div className="mock-ws-card">
          <span className="mock-ws-card-title">새 문제 만들기</span>
          <span className="mock-ws-card-desc">
            학년 · 단원 · 평가 차원을 골라 동형 문제를 만듭니다.
          </span>
          <ul className="mock-ws-card-bullets">
            <li>5 ~ 30 초 출제</li>
            <li>SymPy 산술 검증</li>
            <li>A4 PDF 다운로드</li>
          </ul>
          <span className="mock-ws-card-btn">시작하기 →</span>
        </div>
        <div className="mock-ws-card disabled">
          <span className="mock-ws-card-title">이 문제처럼</span>
          <span className="mock-ws-card-desc">
            기존 문제 이미지에서 동형을 추출합니다.
          </span>
          <ul className="mock-ws-card-bullets">
            <li>OCR 이미지 입력</li>
            <li>LaTeX 자동 추출</li>
            <li>같은 평가 차원 보존</li>
          </ul>
          <span className="mock-ws-card-btn disabled">준비 중</span>
        </div>
      </div>
    </div>
  );
}

/* S1 — Grade selection */
function MockGrade() {
  return (
    <div className="mock-grade-screen">
      <div className="mock-subnav">
        <span>← 워크스페이스 / 새 문제 만들기</span>
        <span className="mock-subnav-count">(1/4)</span>
      </div>
      <div className="mock-grade-row-radio">
        {[
          { lbl: "중1", desc: "수와 연산 · 일차방정식", on: false },
          { lbl: "중2", desc: "식의 계산 · 일차함수", on: false },
          { lbl: "중3", desc: "제곱근 · 이차방정식", on: true },
        ].map((g) => (
          <span
            key={g.lbl}
            className={"mock-grade-radio" + (g.on ? " active" : "")}
          >
            <span className="mock-radio-dot" />
            <span className="mock-radio-text">
              <span className="mock-radio-main">{g.lbl}</span>
              <span className="mock-radio-desc">{g.desc}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* S2 — Topic selection */
function MockTopic() {
  return (
    <div className="mock-topic-screen">
      <div className="mock-subnav">
        <span>← 학년 선택 · 중3</span>
        <span className="mock-subnav-count">(2/4)</span>
      </div>
      <div className="mock-filter-row-chip">
        {["전체", "수와 연산", "문자와 식", "함수", "기하"].map((f, i) => (
          <span
            key={f}
            className={"mock-filter-chip-pill" + (i === 0 ? " active" : "")}
          >
            {f}
          </span>
        ))}
      </div>
      <div className="mock-topic-grid">
        {[
          { name: "제곱근과 실수", on: false },
          { name: "이차방정식", on: true },
          { name: "이차함수와 그래프", on: false },
          { name: "삼각비", on: false },
        ].map((t) => (
          <span
            key={t.name}
            className={"mock-topic-card" + (t.on ? " active" : "")}
          >
            <span className="mock-radio-dot" />
            <span className="mock-topic-name">{t.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* S3 — Intent (동형 모드 + 평가 차원) */
function MockIntent() {
  return (
    <div className="mock-intent">
      <div className="mock-subnav">
        <span>← 단원 선택 · 이차방정식</span>
        <span className="mock-subnav-count">(3/4) 의도 확인</span>
      </div>
      <div className="mock-mode-row">
        <span className="mock-mode-card active">
          <span className="mock-radio-dot" />
          <span className="mock-mode-label">구조 동형</span>
          <span className="mock-badge pass">✓ 구조</span>
        </span>
        <span className="mock-mode-card">
          <span className="mock-radio-dot empty" />
          <span className="mock-mode-label">개념 동형</span>
          <span className="mock-badge concept">✦ 개념</span>
        </span>
      </div>
      <div className="mock-dim-list">
        {[
          { k: "A", text: "인수분해 또는 근의 공식 사용", on: true },
          { k: "B", text: "판별식으로 해의 종류 해석", on: true },
          { k: "C", text: "구한 해를 원식에 대입 검증", on: false },
        ].map((d) => (
          <span
            key={d.k}
            className={"mock-dim-row" + (d.on ? " active" : "")}
          >
            <span className="mock-check">{d.on ? "✓" : ""}</span>
            <span className="mock-dim-key">[{d.k}]</span>
            <span className="mock-dim-text">{d.text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* S4 — Verify (검증 6 단계) */
function MockVerify() {
  const steps = [
    { idx: "1/6", name: "RAG 검색", state: "pass", sum: "12개 참조" },
    { idx: "2/6", name: "의도 추출", state: "pass", sum: "학습 목표 · 제약" },
    { idx: "3/6", name: "문제 생성", state: "active", sum: "진행 중…" },
    { idx: "4/6", name: "산술 검증 (SymPy)", state: "pending", sum: "·" },
    { idx: "5/6", name: "독립 재풀이", state: "pending", sum: "·" },
    { idx: "6/6", name: "학습 목표 매핑", state: "pending", sum: "·" },
  ];
  return (
    <div className="mock-verify-wrap">
      <div className="mock-subnav">
        <span>← 의도 확인 · 중3 · 이차방정식</span>
        <span className="mock-subnav-count">(4/4) 검증 진행</span>
      </div>
      <div className="mock-verify">
        {steps.map((s) => (
          <span
            key={s.idx}
            className={"mock-step-row " + s.state}
          >
            <span className="mock-step-idx">{s.idx}</span>
            <span className="mock-step-name">{s.name}</span>
            <span className="mock-step-sum">{s.sum}</span>
            <span className="mock-step-icon">
              {s.state === "pass" ? "✓" : s.state === "active" ? "" : "·"}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
