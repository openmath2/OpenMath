"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDraftStorage } from "@/hooks/use-draft-storage";
import {
  type Category,
  type Grade,
  type Topic,
  categories,
  gradeLabel,
  topics,
} from "./data";

type Filter = "전체" | Category;

type Props = {
  grade: Grade | null;
};

export function TopicPicker({ grade }: Props) {
  const [filter, setFilter] = useState<Filter>("전체");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const { saveDraft, loadDraft } = useDraftStorage();

  /* OM-47: 진입 시 draft 의 topic 으로 복원 (draft 의 topic 이 현재 학년의 유효 단원일 때만). */
  useEffect(() => {
    const draft = loadDraft();
    if (draft !== null && draft.topic !== null) {
      const valid = topics.find(
        (t) => t.code === draft.topic && t.grade === grade,
      );
      if (valid !== undefined) {
        setSelectedCode(valid.code);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade]);

  const chooseTopic = (code: string): void => {
    setSelectedCode(code);
    saveDraft({ topic: code });
  };

  const visible = useMemo<Topic[]>(() => {
    if (grade === null) return [];
    return topics.filter(
      (t) => t.grade === grade && (filter === "전체" || t.category === filter),
    );
  }, [grade, filter]);

  if (grade === null) {
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
      ? `/app/new/intent?grade=${grade}&topic=${encodeURIComponent(selectedCode)}`
      : null;

  return (
    <>
      <nav className="container-app sub-nav" aria-label="단계 이동">
        <div>
          <Link href="/app/new/grade" className="crumb">
            <span aria-hidden="true">←</span>
            <span>학년 선택</span>
          </Link>
          <span className="crumb-sep" aria-hidden="true">·</span>
          <span className="crumb-current">{gradeLabel(grade)}</span>
        </div>
        <span className="progress" aria-label="4 단계 중 2 단계">
          (2/4)
        </span>
      </nav>

      <main className="container-app page-body">
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

        {visible.length === 0 ? (
          <p className="empty-state">
            해당 학년 · 영역에 등록된 단원이 없습니다.
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
                  onChange={() => chooseTopic(t.code)}
                  className="sr-only"
                />
                <span className="dot" aria-hidden="true" />
                <span className="label">
                  <span className="label-main">
                    <span>{t.name}</span>
                    <span className="meta-pill" aria-label={`성취기준 ${t.code}`}>
                      {t.code}
                    </span>
                  </span>
                  <span className="label-desc">{t.achievement}</span>
                </span>
              </label>
            ))}
          </div>
        )}
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
