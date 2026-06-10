"use client";

import Link from "next/link";
import { useState } from "react";
import type { Grade, SchoolLevel } from "../topic/data";

type GradeSelection = {
  schoolLevel: SchoolLevel;
  grade: Grade | null;
};

type GradeOption = {
  value: string;
  selection: GradeSelection;
  label: string;
  desc: string;
};

const grades: GradeOption[] = [
  { value: "middle-1", selection: { schoolLevel: "middle", grade: 1 }, label: "중1", desc: "수와 연산 · 일차방정식 · 기본 도형" },
  { value: "middle-2", selection: { schoolLevel: "middle", grade: 2 }, label: "중2", desc: "식의 계산 · 일차함수 · 도형의 성질" },
  { value: "middle-3", selection: { schoolLevel: "middle", grade: 3 }, label: "중3", desc: "제곱근 · 이차방정식 · 이차함수" },
  { value: "high-common", selection: { schoolLevel: "high", grade: null }, label: "고등 공통수학", desc: "다항식 · 방정식 · 함수 · 경우의 수" },
];

function topicHref(selection: GradeSelection): string {
  const grade = selection.grade === null ? "common" : String(selection.grade);
  return `/app/new/topic?school=${selection.schoolLevel}&grade=${grade}`;
}

export function GradePicker() {
  const [selected, setSelected] = useState<GradeOption | null>(null);

  return (
    <>
      <nav className="container-app sub-nav" aria-label="단계 이동">
        <div>
          <Link href="/app" className="crumb">
            <span aria-hidden="true">←</span>
            <span>워크스페이스</span>
          </Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current">새 문제 만들기</span>
        </div>
        <span className="progress" aria-label="4 단계 중 1 단계">
          (1/4)
        </span>
      </nav>

      <main className="container-app page-body">
        <h1 className="page-title" id="page-title">
          어느 학년인가요?
        </h1>
        <p className="page-subtitle">이번 출제의 대상 학년을 고르세요.</p>

        <div
          className="grade-grid"
          role="radiogroup"
          aria-labelledby="page-title"
        >
          {grades.map((g) => (
            <label key={g.value} className="intent-radio-card">
              <input
                type="radio"
                name="grade"
                value={g.value}
                checked={selected?.value === g.value}
                onChange={() => setSelected(g)}
                className="sr-only"
              />
              <span className="dot" aria-hidden="true" />
              <span className="label">
                <span className="label-main">{g.label}</span>
                <span className="label-desc">{g.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </main>

      <div className="action-bar-sticky">
        <div className="container-app action-bar-inner">
          <div className="left">
            <Link href="/app" className="btn btn-secondary">
              <span>취소</span>
            </Link>
          </div>
          <div className="right">
            {selected !== null ? (
              <Link
                href={topicHref(selected.selection)}
                className="btn btn-primary"
              >
                <span>다음</span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled
                aria-describedby="grade-next-reason"
              >
                <span>다음</span>
                <span aria-hidden="true">→</span>
              </button>
            )}
            <span id="grade-next-reason" className="sr-only">
              학년을 1 개 선택하세요.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
