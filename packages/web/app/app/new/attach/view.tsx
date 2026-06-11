"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { LatexMixed } from "@/components/math/latex-renderer";
import {
  type Grade,
  type SchoolLevel,
  findTopic,
  topicsForScope,
} from "../topic/data";
import {
  type ExtractResult,
  extractFromImage,
  extractFromText,
} from "@/lib/extract-client";

type Phase = "input" | "extracting" | "confirm";
type InputMode = "text" | "image";
type IsoMode = "structural" | "conceptual";

const isoModes: {
  value: IsoMode;
  label: string;
  desc: string;
  badgeClass: "badge-pass" | "badge-concept";
  badgeText: string;
}[] = [
  {
    value: "structural",
    label: "구조가 같은 문제",
    desc: "숫자 · 계수만 바꿔 원본과 같은 풀이 흐름을 따릅니다.",
    badgeClass: "badge-pass",
    badgeText: "Structural",
  },
  {
    value: "conceptual",
    label: "개념이 같은 문제",
    desc: "풀이 경로는 달라도 같은 학습 목표를 평가합니다.",
    badgeClass: "badge-concept",
    badgeText: "Conceptual",
  },
];

function difficultyLabel(d: "easy" | "medium" | "hard"): string {
  if (d === "easy") return "하";
  if (d === "medium") return "중";
  return "상";
}

function problemTypeLabel(t: string): string {
  if (t === "objective") return "객관식";
  if (t === "short_answer") return "단답형";
  if (t === "essay") return "서술형";
  return "주관식";
}

function newAttachedId(): string {
  const c = globalThis.crypto;
  if (c !== undefined && typeof c.randomUUID === "function") return `attached-${c.randomUUID()}`;
  return `attached-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function AttachView() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("input");
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [text, setText] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<ExtractResult | null>(null);
  const [questionText, setQuestionText] = useState<string>("");
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>("middle");
  const [grade, setGrade] = useState<Grade | null>(1);
  const [topicCode, setTopicCode] = useState<string>("");
  const [isoMode, setIsoMode] = useState<IsoMode>("structural");

  useEffect(() => {
    return () => {
      if (filePreview !== null) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const topicOptions = useMemo(
    () => topicsForScope(schoolLevel, schoolLevel === "high" ? null : grade),
    [schoolLevel, grade],
  );

  const alternatives = useMemo(() => {
    if (result === null) return [];
    return result.classification.alternatives
      .map((alt) => findTopic(alt.topic_code))
      .filter((topic): topic is NonNullable<typeof topic> => topic !== null)
      .filter((topic) => topic.code !== topicCode);
  }, [result, topicCode]);

  const onPickFile = (next: File | null) => {
    setError(null);
    setFile(next);
    setFilePreview((prev) => {
      if (prev !== null) URL.revokeObjectURL(prev);
      return next === null ? null : URL.createObjectURL(next);
    });
  };

  const seedConfirm = (res: ExtractResult) => {
    const c = res.classification;
    const level = c.school_level;
    const seededGrade: Grade | null = level === "high" ? null : c.grade ?? 1;
    const scope = topicsForScope(level, level === "high" ? null : seededGrade);
    setResult(res);
    setQuestionText(res.extraction.question_text);
    setSchoolLevel(level);
    setGrade(seededGrade);
    setTopicCode(scope.some((t) => t.code === c.topic_code) ? c.topic_code : "");
    setIsoMode("structural");
  };

  const runExtract = async () => {
    if (inputMode === "text" && text.trim().length === 0) return;
    if (inputMode === "image" && file === null) return;
    setError(null);
    setPhase("extracting");
    try {
      const res =
        inputMode === "text"
          ? await extractFromText(text.trim())
          : await extractFromImage(file as File);
      seedConfirm(res);
      setPhase("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "문제를 읽지 못했어요. 다시 시도해 주세요.");
      setPhase("input");
    }
  };

  const onSchoolChange = (level: SchoolLevel) => {
    setSchoolLevel(level);
    setGrade(level === "high" ? null : 1);
    setTopicCode("");
  };

  const onGradeChange = (g: Grade) => {
    setGrade(g);
    setTopicCode("");
  };

  const onPickAlternative = (code: string) => {
    const topic = findTopic(code);
    if (topic === null) return;
    setSchoolLevel(topic.schoolLevel);
    setGrade(topic.grade);
    setTopicCode(topic.code);
  };

  const canExtract =
    (inputMode === "text" && text.trim().length > 0) ||
    (inputMode === "image" && file !== null);

  const canCreate =
    questionText.trim().length > 0 &&
    topicCode !== "" &&
    (schoolLevel === "high" || grade !== null);

  const handleCreate = () => {
    if (!canCreate) return;
    const itemId = newAttachedId();
    const difficulty = result?.classification.difficulty ?? "medium";
    try {
      window.sessionStorage.setItem(
        "openmath:intent-source",
        JSON.stringify({
          item_id: itemId,
          question_text: questionText.trim(),
          difficulty_norm: difficulty,
        }),
      );
    } catch (err) {
      console.warn("[attach] sessionStorage write failed:", err);
    }
    const params = new URLSearchParams();
    params.set("school", schoolLevel);
    params.set("grade", grade === null ? "common" : String(grade));
    params.set("topic", topicCode);
    params.set("mode", isoMode);
    params.set("srcRef", itemId);
    router.push(`/app/new/verify?${params.toString()}`);
  };

  const isExtracting = phase === "extracting";

  if (phase === "confirm" && result !== null) {
    return (
      <>
        <nav className="container-app sub-nav" aria-label="단계 이동">
          <div>
            <Link href="/app" className="crumb">
              <span aria-hidden="true">←</span>
              <span>워크스페이스</span>
            </Link>
            <span className="crumb-sep" aria-hidden="true">·</span>
            <span className="crumb-current">읽은 문제 확인</span>
          </div>
        </nav>

        <main className="container-app page-body">
          <h1 className="page-title" id="page-title">이렇게 읽었어요 — 맞나요?</h1>
          <p className="page-subtitle">
            읽은 내용과 학년 · 단원을 확인하고 필요하면 고쳐 주세요. 이 문제를 기준으로 같은 유형의 문제를 만듭니다.
          </p>

          {result.warnings.length > 0 ? (
            <div className="inline-notice inline-notice-warn" role="status">
              <span className="icon" aria-hidden="true">⚠</span>
              <span className="body">
                {result.warnings.map((w, i) => (
                  <span key={i} style={{ display: "block" }}>{w}</span>
                ))}
              </span>
            </div>
          ) : null}

          <section className="section-block" aria-labelledby="read-heading">
            <h2 className="heading-md" id="read-heading">읽은 문제</h2>
            <label className="attach-field">
              <span className="field-label">문제 본문 (수식은 $…$ 로 표시)</span>
              <textarea
                className="attach-textarea"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                aria-label="읽은 문제 본문"
              />
            </label>
            <div className="attach-preview" aria-live="polite">
              <span className="caption">미리보기</span>
              <LatexMixed source={questionText} />
            </div>
            <p className="attach-alt-row" aria-hidden="true">
              자동 인식
              <span className="meta-pill">{difficultyLabel(result.classification.difficulty)}</span>
              <span className="meta-pill">{problemTypeLabel(result.classification.problem_type)}</span>
            </p>
          </section>

          <section className="section-block" aria-labelledby="scope-heading">
            <h2 className="heading-md" id="scope-heading">학년 · 단원</h2>
            <div className="attach-fields">
              <label className="attach-field">
                <span className="field-label">학교급</span>
                <select
                  className="attach-select"
                  value={schoolLevel}
                  onChange={(e) => onSchoolChange(e.target.value as SchoolLevel)}
                >
                  <option value="middle">중학교</option>
                  <option value="high">고등학교 (공통수학)</option>
                </select>
              </label>

              {schoolLevel === "middle" ? (
                <label className="attach-field">
                  <span className="field-label">학년</span>
                  <select
                    className="attach-select"
                    value={grade === null ? "" : String(grade)}
                    onChange={(e) => onGradeChange(Number(e.target.value) as Grade)}
                  >
                    <option value="1">중1</option>
                    <option value="2">중2</option>
                    <option value="3">중3</option>
                  </select>
                </label>
              ) : null}

              <label className="attach-field">
                <span className="field-label">단원</span>
                <select
                  className="attach-select"
                  value={topicCode}
                  onChange={(e) => setTopicCode(e.target.value)}
                >
                  <option value="">단원 선택</option>
                  {topicOptions.map((topic) => (
                    <option key={topic.code} value={topic.code}>{topic.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {alternatives.length > 0 ? (
              <div className="attach-alt-row">
                <span>혹시 이 단원인가요?</span>
                {alternatives.map((topic) => (
                  <button
                    key={topic.code}
                    type="button"
                    className="filter-chip"
                    onClick={() => onPickAlternative(topic.code)}
                  >
                    {topic.name}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="section-block" aria-labelledby="iso-heading">
            <h2 className="heading-md" id="iso-heading">어떤 유형으로 만들까요?</h2>
            <div className="mode-grid" role="radiogroup" aria-labelledby="iso-heading">
              {isoModes.map((m) => (
                <label key={m.value} className="intent-radio-card">
                  <input
                    type="radio"
                    name="iso-mode"
                    value={m.value}
                    checked={isoMode === m.value}
                    onChange={() => setIsoMode(m.value)}
                    className="sr-only"
                  />
                  <span className="dot" aria-hidden="true" />
                  <span className="label">
                    <span className="label-main">
                      <span>{m.label}</span>
                      <span className={`badge ${m.badgeClass}`}>
                        <span>{m.badgeText}</span>
                      </span>
                    </span>
                    <span className="label-desc">{m.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </main>

        <div className="action-bar-sticky">
          <div className="container-app action-bar-inner">
            <div className="left">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPhase("input");
                  setError(null);
                }}
              >
                <span aria-hidden="true">←</span>
                <span>다시 첨부</span>
              </button>
            </div>
            <div className="right">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!canCreate}
                aria-describedby="create-reason"
              >
                <span>이 문제로 만들기</span>
                <span aria-hidden="true">→</span>
              </button>
              <span id="create-reason" className="sr-only">
                {questionText.trim().length === 0
                  ? "문제 본문을 입력하세요."
                  : topicCode === ""
                    ? "단원을 선택하세요."
                    : "학년을 선택하세요."}
              </span>
            </div>
          </div>
        </div>
      </>
    );
  }

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
        <h1 className="page-title" id="page-title">이 문제처럼 만들기</h1>
        <p className="page-subtitle">
          가지고 있는 문제를 붙여넣거나 사진으로 올리면, 학년 · 단원을 자동으로 인식하고 같은 유형의 문제를 만듭니다.
        </p>

        <div className="attach-toggle" role="tablist" aria-label="첨부 방식">
          <button
            type="button"
            className="filter-chip"
            role="tab"
            aria-selected={inputMode === "text"}
            aria-pressed={inputMode === "text"}
            disabled={isExtracting}
            onClick={() => setInputMode("text")}
          >
            텍스트 붙여넣기
          </button>
          <button
            type="button"
            className="filter-chip"
            role="tab"
            aria-selected={inputMode === "image"}
            aria-pressed={inputMode === "image"}
            disabled={isExtracting}
            onClick={() => setInputMode("image")}
          >
            사진 올리기
          </button>
        </div>

        {inputMode === "text" ? (
          <label className="attach-field">
            <span className="sr-only">문제 텍스트</span>
            <textarea
              className="attach-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"문제를 여기에 붙여넣어 주세요.\n예) 이차방정식 x^2 - 5x + 6 = 0 의 두 근의 합을 구하시오."}
              disabled={isExtracting}
              aria-label="문제 텍스트"
            />
          </label>
        ) : (
          <div className="attach-dropzone">
            {filePreview !== null ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="attach-image-preview" src={filePreview} alt="올린 문제 사진 미리보기" />
            ) : (
              <p className="hint">문제 사진(PNG · JPG · WEBP, 10MB 이하)을 올려 주세요.</p>
            )}
            <label className="btn btn-secondary">
              <span>{file === null ? "사진 선택" : "다른 사진 선택"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                className="sr-only"
                disabled={isExtracting}
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file !== null ? <p className="hint">{file.name}</p> : null}
          </div>
        )}

        {error !== null ? (
          <div className="inline-notice inline-notice-fail" role="alert">
            <span className="icon" aria-hidden="true">✗</span>
            <span className="body">{error}</span>
          </div>
        ) : null}

        {isExtracting ? (
          <div className="inline-notice inline-notice-warn" role="status">
            <span className="icon" aria-hidden="true">…</span>
            <span className="body">문제를 읽고 있어요. 잠시만 기다려 주세요.</span>
          </div>
        ) : null}
      </main>

      <div className="action-bar-sticky">
        <div className="container-app action-bar-inner">
          <div className="left">
            <Link href="/app" className="btn btn-secondary">
              <span aria-hidden="true">←</span>
              <span>워크스페이스</span>
            </Link>
          </div>
          <div className="right">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void runExtract()}
              disabled={!canExtract || isExtracting}
            >
              <span>{isExtracting ? "읽는 중…" : "문제 읽기"}</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
