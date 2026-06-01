import type { Metadata } from "next";
import { findTopic, parseGrade, pickFirst } from "../topic/data";
import { VerifyView } from "./view";

export const metadata: Metadata = {
  title: "검증 진행 — OpenMath",
  description: "생성과 검증을 6 단계로 진행합니다. 실시간 진행 상태를 노출합니다.",
};

type Props = {
  searchParams: {
    grade?: string | string[];
    topic?: string | string[];
    mode?: string | string[];
    dims?: string | string[];
    difficulty?: string | string[];
    problem_type?: string | string[];
  };
};

function parseMode(raw: string | null): "structural" | "conceptual" | null {
  if (raw === "structural" || raw === "conceptual") return raw;
  return null;
}

function parseDims(raw: string | null): string[] {
  if (raw === null) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/* OM-48: S3 에서 명시 선택. 누락 시 BE schema 와 동일한 default 로 fallback. */
function parseDifficulty(raw: string | null): "easy" | "medium" | "hard" {
  if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  return "medium";
}

function parseProblemType(raw: string | null): "objective" | "short_answer" {
  if (raw === "objective" || raw === "short_answer") return raw;
  return "objective";
}

export default function VerifyPage({ searchParams }: Props) {
  const grade = parseGrade(searchParams.grade);
  const topic = findTopic(pickFirst(searchParams.topic));
  const mode = parseMode(pickFirst(searchParams.mode));
  const dims = parseDims(pickFirst(searchParams.dims));
  const difficulty = parseDifficulty(pickFirst(searchParams.difficulty));
  const problemType = parseProblemType(pickFirst(searchParams.problem_type));

  return (
    <VerifyView
      grade={grade}
      topic={topic}
      mode={mode}
      dims={dims}
      difficulty={difficulty}
      problemType={problemType}
    />
  );
}
