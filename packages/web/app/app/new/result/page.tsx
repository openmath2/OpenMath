import type { Metadata } from "next";
import { findTopic, parseGrade, parseSchoolLevel, pickFirst } from "../topic/data";
import { generateMockResults } from "./mock";
import { ResultView } from "./view";

export const metadata: Metadata = {
  title: "결과 — OpenMath",
  description: "검증 통과한 문항을 검토하고 채택합니다.",
};

type Props = {
  searchParams: {
    grade?: string | string[];
    school?: string | string[];
    topic?: string | string[];
    mode?: string | string[];
    dims?: string | string[];
    source?: string | string[];
  };
};

function parseMode(
  raw: string | null,
): "structural" | "conceptual" | null {
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

export default function ResultPage({ searchParams }: Props) {
  const schoolLevel = parseSchoolLevel(searchParams.school);
  const grade = parseGrade(searchParams.grade);
  const topic = findTopic(pickFirst(searchParams.topic));
  const mode = parseMode(pickFirst(searchParams.mode));
  const dims = parseDims(pickFirst(searchParams.dims));
  const sourceProblemText = pickFirst(searchParams.source) ?? "";

  const problems =
    topic !== null && mode !== null
      ? generateMockResults(topic, mode, dims)
      : [];

  return (
    <ResultView
      grade={grade}
      schoolLevel={schoolLevel}
      topic={topic}
      mode={mode}
      dims={dims}
      sourceProblemText={sourceProblemText}
      problems={problems}
    />
  );
}
