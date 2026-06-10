"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  type Grade,
  type SchoolLevel,
  type Topic,
  gradeLabel,
  topicScopeLabel,
} from "../topic/data";
import { LatexMixed } from "@/components/math/latex-renderer";
import {
  type Difficulty,
  type SourceProblem,
  getSourceProblems,
} from "@/lib/source-problems-client";

type IsomorphismMode = "structural" | "conceptual";
type DifficultyFilter = "all" | Difficulty;

type ModeOption = {
  value: IsomorphismMode;
  label: string;
  desc: string;
  badgeClass: "badge-pass" | "badge-concept";
  badgeIcon: string;
  badgeText: string;
};

type DifficultyChip = {
  value: DifficultyFilter;
  label: string;
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
    desc: "풀이 경로는 달라도 같은 학습 목표를 보존합니다.",
    badgeClass: "badge-concept",
    badgeIcon: "✦",
    badgeText: "Conceptual",
  },
];

const difficultyChips: DifficultyChip[] = [
  { value: "all", label: "전체" },
  { value: "hard", label: "상" },
  { value: "medium", label: "중" },
  { value: "easy", label: "하" },
];

function difficultyLabel(d: Difficulty): string {
  if (d === "easy") return "하";
  if (d === "medium") return "중";
  return "상";
}

type Props = {
  schoolLevel: SchoolLevel;
  grade: Grade | null;
  topic: Topic | null;
  candidates: SourceProblem[];
};

export function IntentPicker({ schoolLevel, grade, topic, candidates }: Props) {
  const [mode, setMode] = useState<IsomorphismMode | null>("structural");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [displayed, setDisplayed] = useState<SourceProblem[]>(candidates);
  const [loadingDiff, setLoadingDiff] = useState<boolean>(false);
  const [diffError, setDiffError] = useState<boolean>(false);

  /* difficulty 별 결과 캐시 — 같은 칩 재클릭 시 네트워크 왕복 회피.
   * "all" 은 SSR set 으로 seed. ref 를 lazy-init 으로 1회만 채운다.
   */
  const cacheRef = useRef<Map<DifficultyFilter, SourceProblem[]> | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = new Map<DifficultyFilter, SourceProblem[]>([
      ["all", candidates],
    ]);
  }

  /* 빠른 연속 칩 클릭의 race 방어 — 늦게 도착한 응답이 최신 selection 을
   * 덮어쓰지 않도록 request id 토큰으로 stale 응답을 식별·드롭한다.
   */
  const requestIdRef = useRef<number>(0);

  if ((schoolLevel === "middle" && grade === null) || topic === null) {
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

  const gradeParam = grade === null ? "common" : String(grade);
  const sameIntentHref = `/app/new/intent?school=${schoolLevel}&grade=${gradeParam}&topic=${encodeURIComponent(topic.code)}`;

  if (candidates.length === 0) {
    return (
      <>
        <nav className="container-app sub-nav" aria-label="단계 이동">
          <div>
            <Link
              href={`/app/new/topic?school=${schoolLevel}&grade=${gradeParam}`}
              className="crumb"
            >
              <span aria-hidden="true">←</span>
              <span>단원 선택</span>
            </Link>
            <span className="crumb-sep" aria-hidden="true">·</span>
            <span className="crumb-current">
              {gradeLabel(grade, schoolLevel)} · {topic.name}
            </span>
          </div>
          <span className="progress" aria-label="4 단계 중 3 단계">
            (3/4) 의도 확인
          </span>
        </nav>
        <main className="container-app page-body">
          <h1 className="page-title">기준 문항을 불러오지 못했어요</h1>
          <p className="page-subtitle">
            현재 단원({topic.name})에 해당하는 corpus 문항이 비어 있거나
            agent 서버에 일시적인 문제가 있을 수 있습니다. 잠시 후 다시
            시도해 주세요.
          </p>
          <Link href={sameIntentHref} className="btn btn-primary" prefetch={false}>
            <span>다시 불러오기</span>
            <span aria-hidden="true">↻</span>
          </Link>
        </main>
      </>
    );
  }

  const topicCode = topic.code;

  const loadDifficulty = async (chip: DifficultyFilter): Promise<void> => {
    setDifficulty(chip);
    setDiffError(false);

    const cache = cacheRef.current;
    if (cache === null) return;

    const cached = cache.get(chip);
    if (cached !== undefined) {
      setDisplayed(cached);
      if (
        selectedItemId.length > 0 &&
        !cached.some((c) => c.item_id === selectedItemId)
      ) {
        setSelectedItemId("");
      }
      return;
    }

    if (chip === "all") {
      /* 방어 경로 — cache 는 항상 "all" seed 를 가져야 하지만, 안전망. */
      setDisplayed(candidates);
      return;
    }

    const myRequestId = ++requestIdRef.current;
    setLoadingDiff(true);

    let result: SourceProblem[];
    try {
      result = await getSourceProblems({
        schoolLevel,
        grade,
        topicCode,
        difficulty: chip,
        limit: 30,
      });
    } catch (err) {
      if (requestIdRef.current === myRequestId) {
        console.warn(
          `[intent-source] difficulty=${chip} fetch threw:`,
          err,
        );
        setDiffError(true);
        setLoadingDiff(false);
      }
      return;
    }

    if (requestIdRef.current !== myRequestId) return;

    cache.set(chip, result);
    setDisplayed(result);
    if (
      selectedItemId.length > 0 &&
      !result.some((c) => c.item_id === selectedItemId)
    ) {
      setSelectedItemId("");
    }
    setLoadingDiff(false);
  };

  const canSubmit = mode !== null && selectedItemId !== "";

  /* selectedItemId 가 현재 displayed 에 있으면 거기서 → 없으면 (사용자가
   * 선택 후 다른 칩 → 같은 칩 돌아왔으나 캐시 만료 상황 등) SSR `candidates`
   * 에서 fallback. 둘 다 못 찾으면 stale selection 으로 null 처리.
   */
  const selectedProblem =
    selectedItemId.length > 0
      ? (displayed.find((c) => c.item_id === selectedItemId) ??
        candidates.find((c) => c.item_id === selectedItemId) ??
        null)
      : null;

  let generateHref: string | null = null;
  if (canSubmit && mode !== null && selectedProblem !== null) {
    const params = new URLSearchParams();
    params.set("school", schoolLevel);
    params.set("grade", gradeParam);
    params.set("topic", topicCode);
    params.set("mode", mode);
    params.set("srcRef", selectedProblem.item_id);
    generateHref = `/app/new/verify?${params.toString()}`;
  }

  const handleSubmit = (): void => {
    if (selectedProblem === null) return;
    try {
      window.sessionStorage.setItem(
        "openmath:intent-source",
        JSON.stringify({
          item_id: selectedProblem.item_id,
          question_text: selectedProblem.question_text,
          difficulty_norm: selectedProblem.difficulty_norm,
        }),
      );
    } catch (err) {
      console.warn("[intent-source] sessionStorage write failed:", err);
    }
  };

  const retryButtonStyle = {
    background: "transparent",
    border: "none",
    color: "var(--color-warn-deep)",
    textDecoration: "underline",
    cursor: "pointer",
    font: "inherit",
    padding: 0,
    marginLeft: "4px",
  } as const;

  return (
    <>
      <nav className="container-app sub-nav" aria-label="단계 이동">
        <div>
          <Link
            href={`/app/new/topic?school=${schoolLevel}&grade=${gradeParam}`}
            className="crumb"
          >
            <span aria-hidden="true">←</span>
            <span>단원 선택</span>
          </Link>
          <span className="crumb-sep" aria-hidden="true">·</span>
          <span className="crumb-current">
            {gradeLabel(grade, schoolLevel)} · {topic.name}
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
          {topicScopeLabel(topic)} 기준입니다. 동형 방식과 기준 문항을 골라
          주세요. 검증 6 단계가 이 기준을 따라 진행됩니다.
        </p>

        <section className="section-block" aria-labelledby="mode-heading">
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

        <section
          className="section-block"
          aria-labelledby="reference-heading"
        >
          <h2 className="heading-md" id="reference-heading">
            어떤 문제를 기준으로 만들까요?
          </h2>
          <p className="page-subtitle">
            corpus 에서 가져온 후보 중 하나를 선택해 주세요. 구조 동형은
            풀이 구조를, 개념 동형은 학습 목표를 이 문항에서 가져옵니다.
          </p>

          <div className="filter-row" role="toolbar" aria-label="난이도 필터">
            {difficultyChips.map((chip) => {
              const active = difficulty === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  className="filter-chip"
                  aria-pressed={active}
                  onClick={() => {
                    void loadDifficulty(chip.value);
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
            {loadingDiff ? (
              <span
                className="meta-pill"
                role="status"
                aria-live="polite"
              >
                불러오는 중…
              </span>
            ) : null}
          </div>

          {diffError ? (
            <div
              className="inline-notice inline-notice-warn"
              role="status"
            >
              <span className="icon" aria-hidden="true">
                ⚠
              </span>
              <span className="body">
                난이도별 문항을 불러오지 못했어요. 잠시 후
                <button
                  type="button"
                  onClick={() => {
                    void loadDifficulty(difficulty);
                  }}
                  style={retryButtonStyle}
                >
                  다시 시도
                </button>
                해 주세요.
              </span>
            </div>
          ) : null}

          {displayed.length === 0 ? (
            <p className="empty-state">
              선택한 난이도에 해당하는 문항이 없습니다. 다른 난이도를
              선택해 주세요.
            </p>
          ) : (
            <div
              className="reference-list"
              role="radiogroup"
              aria-labelledby="reference-heading"
              aria-busy={loadingDiff}
            >
              {displayed.map((c) => (
                <label key={c.item_id} className="intent-radio-card">
                  <input
                    type="radio"
                    name="reference-problem"
                    value={c.item_id}
                    checked={selectedItemId === c.item_id}
                    onChange={() => setSelectedItemId(c.item_id)}
                    className="sr-only"
                  />
                  <span className="dot" aria-hidden="true" />
                  <span className="label">
                    <span className="label-main">
                      <span className="meta-pill">
                        {difficultyLabel(c.difficulty_norm)}
                      </span>
                      <span className="example-badge example-badge-type">
                        {c.topic_name}
                      </span>
                    </span>
                    <span className="label-desc">
                      <LatexMixed source={c.question_text} />
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>
      </main>

      <div className="action-bar-sticky">
        <div className="container-app action-bar-inner">
          <div className="left">
            <Link
              href={`/app/new/topic?school=${schoolLevel}&grade=${gradeParam}`}
              className="btn btn-secondary"
            >
              <span aria-hidden="true">←</span>
              <span>뒤로</span>
            </Link>
          </div>
          <div className="right">
            {generateHref !== null ? (
              <Link
                href={generateHref}
                className="btn btn-primary"
                onClick={handleSubmit}
              >
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
              {mode === null && selectedItemId === ""
                ? "동형 모드를 선택하고 기준 문항을 1 개 선택하세요."
                : mode === null
                  ? "동형 모드를 선택하세요."
                  : "기준 문항을 1 개 선택하세요."}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
