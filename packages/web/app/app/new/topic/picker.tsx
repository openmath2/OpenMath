"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LatexMixed } from "@/components/math/latex-renderer";
import {
  type Category,
  type Grade,
  type SchoolLevel,
  type Topic,
  categories,
  gradeLabel,
  topicScopeLabel,
  topicsForScope,
} from "./data";
import examplesData from "./examples.json";

type Filter = "전체" | Category;

type Props = {
  schoolLevel: SchoolLevel;
  grade: Grade | null;
};

type ExampleEntry = {
  id: string;
  achievement_code_2015: string;
  topic_name_2015: string;
  difficulty: "easy" | "medium" | "hard";
  problem_type: "objective" | "essay" | "short_answer" | "subjective";
  question_text: string;
  answer_text: string;
};

type ExamplesUnit = {
  ui_name: string;
  grade: number | null;
  candidate_pool: number;
  examples: ExampleEntry[];
};

const examples = (examplesData as { units: Record<string, ExamplesUnit> })
  .units;

function difficultyLabel(d: ExampleEntry["difficulty"]): string {
  return d === "easy" ? "쉬움" : d === "medium" ? "보통" : "어려움";
}

function problemTypeLabel(t: ExampleEntry["problem_type"]): string {
  switch (t) {
    case "objective":
      return "객관식";
    case "essay":
      return "서술형";
    case "short_answer":
      return "단답형";
    case "subjective":
      return "주관식";
  }
}

export function TopicPicker({ schoolLevel, grade }: Props) {
  const [filter, setFilter] = useState<Filter>("전체");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const visible = useMemo<Topic[]>(() => {
    return topicsForScope(schoolLevel, grade).filter(
      (t) => filter === "전체" || t.category === filter,
    );
  }, [schoolLevel, grade, filter]);

  if (schoolLevel === "middle" && grade === null) {
    return (
      <>
        <nav className="container-app sub-nav" aria-label="단계 이동">
          <div>
            <Link href="/app" className="crumb">
              <span aria-hidden="true">←</span>
              <span>워크스페이스</span>
            </Link>
          </div>
        </nav>
        <main className="container-app page-body">
          <h1 className="page-title">학년 정보가 필요해요</h1>
          <p className="page-subtitle">
            출제 단원을 고르기 전에 학년을 먼저 선택해 주세요.
          </p>
          <Link href="/app/new/grade" className="btn btn-primary">
            <span>학년 선택으로</span>
            <span aria-hidden="true">→</span>
          </Link>
        </main>
      </>
    );
  }

  const nextHref =
    selectedCode !== null
      ? `/app/new/intent?school=${schoolLevel}&grade=${grade === null ? "common" : grade}&topic=${encodeURIComponent(selectedCode)}`
      : null;
  const selectedTopic = visible.find((t) => t.code === selectedCode) ?? null;
  const selectedExamples = selectedCode ? examples[selectedCode] : undefined;

  return (
    <>
      <nav className="container-app sub-nav" aria-label="단계 이동">
        <div>
          <Link href="/app/new/grade" className="crumb">
            <span aria-hidden="true">←</span>
            <span>학년 선택</span>
          </Link>
          <span className="crumb-sep" aria-hidden="true">·</span>
          <span className="crumb-current">{gradeLabel(grade, schoolLevel)}</span>
        </div>
        <span className="progress" aria-label="4 단계 중 2 단계">
          (2/4)
        </span>
      </nav>

      <main className="container-app page-body topic-picker">
        <h1 className="page-title" id="page-title">
          어느 단원인가요?
        </h1>
        <p className="page-subtitle">
          2022 개정 교육과정의 성취기준 단위로 정렬되어 있습니다.
        </p>

        <div
          className="filter-row"
          role="toolbar"
          aria-label="대단원 필터"
        >
          {categories.map((cat) => {
            const active = filter === cat;
            return (
              <button
                key={cat}
                type="button"
                className="filter-chip"
                aria-pressed={active}
                onClick={() => {
                  setFilter(cat);
                  setSelectedCode(null);
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="topic-layout">
          <section
            className="topic-cards"
            aria-label="단원 목록"
          >
            {visible.length === 0 ? (
              <p className="empty-state">
                해당 학제 · 영역에 선택 가능한 단원이 없습니다. 필터를 다시
                선택해 보세요.
              </p>
            ) : (
              <div
                className="topic-grid"
                role="radiogroup"
                aria-labelledby="page-title"
              >
                {visible.map((t) => (
                  <label key={t.code} className="intent-radio-card">
                    <input
                      type="radio"
                      name="topic"
                      value={t.code}
                      checked={selectedCode === t.code}
                      onChange={() => setSelectedCode(t.code)}
                      className="sr-only"
                    />
                    <span className="dot" aria-hidden="true" />
                    <span className="label">
                      <span className="label-main">
                        <span>{t.name}</span>
                        <span
                          className="meta-pill"
                          aria-label={`성취기준 ${t.code}`}
                        >
                          {t.code}
                        </span>
                      </span>
                      <span className="label-desc">{t.achievement}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {selectedTopic !== null && selectedExamples !== undefined && (
            <aside
              className="example-panel"
              aria-live="polite"
              aria-label="단원 예시 문제 미리보기"
            >
              <header className="example-panel-header">
                <div className="example-panel-title-row">
                  <h2 className="example-panel-title">
                    {selectedTopic.name}
                  </h2>
                  <span className="meta-pill">{selectedTopic.code}</span>
                </div>
                <p className="example-panel-desc">
                  {topicScopeLabel(selectedTopic)} · {selectedTopic.achievement}
                </p>
                <p className="example-panel-meta">
                  예시 {selectedExamples.examples.length} 문항 · 기출 · 교과 문제
                  {" "}
                  {selectedExamples.candidate_pool.toLocaleString()} 건 중
                  추출
                </p>
              </header>

              <ol className="example-list">
                {selectedExamples.examples.map((ex, idx) => (
                  <li key={ex.id} className="example-card">
                    <div className="example-card-meta">
                      <span className="example-index">예시 {idx + 1}</span>
                      <span className="example-badge example-badge-diff">
                        {difficultyLabel(ex.difficulty)}
                      </span>
                      <span className="example-badge example-badge-type">
                        {problemTypeLabel(ex.problem_type)}
                      </span>
                    </div>
                    <div className="example-question">
                      <LatexMixed source={ex.question_text} />
                    </div>
                    <div className="example-answer">
                      <span className="example-answer-label">정답</span>
                      <span className="example-answer-value">
                        <LatexMixed source={ex.answer_text} />
                      </span>
                    </div>
                  </li>
                ))}
              </ol>

              <footer className="example-panel-footer">
                예시는 기존 기출 · 교과 문제이며, 실제 출제 시 AI 가 동형
                문제를 새로 생성하고 SymPy 가 검증합니다.
              </footer>
            </aside>
          )}
        </div>
      </main>

      <div className="action-bar-sticky">
        <div className="container-app action-bar-inner">
          <div className="left">
            <Link
              href="/app/new/grade"
              className="btn btn-secondary"
            >
              <span aria-hidden="true">←</span>
              <span>뒤로</span>
            </Link>
          </div>
          <div className="right">
            {nextHref !== null ? (
              <Link href={nextHref} className="btn btn-primary">
                <span>다음</span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled
                aria-describedby="topic-next-reason"
              >
                <span>다음</span>
                <span aria-hidden="true">→</span>
              </button>
            )}
            <span id="topic-next-reason" className="sr-only">
              단원을 1 개 선택하세요.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
