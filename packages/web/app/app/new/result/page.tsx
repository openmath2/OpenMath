import type { Metadata } from "next";
import { findTopic, parseGrade, parseSchoolLevel, pickFirst } from "../topic/data";
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
    srcRef?: string | string[];
  };
};

function parseMode(
  raw: string | null,
): "structural" | "conceptual" | null {
  if (raw === "structural" || raw === "conceptual") return raw;
  return null;
}

export default function ResultPage({ searchParams }: Props) {
  const schoolLevel = parseSchoolLevel(searchParams.school);
  const grade = parseGrade(searchParams.grade);
  const topic = findTopic(pickFirst(searchParams.topic));
  const mode = parseMode(pickFirst(searchParams.mode));
  const srcRef = pickFirst(searchParams.srcRef) ?? "";

  return (
    <ResultView
      grade={grade}
      schoolLevel={schoolLevel}
      topic={topic}
      mode={mode}
      sourceItemId={srcRef}
      problems={[]}
    />
  );
}
