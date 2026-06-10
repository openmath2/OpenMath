import type { Metadata } from "next";
import { findTopic, parseGrade, parseSchoolLevel, pickFirst } from "../topic/data";
import { generateMockResults, type ResultProblem } from "../result/mock";
import { ExportView } from "./view";

export const metadata: Metadata = {
  title: "PDF 출력 — OpenMath",
  description: "채택된 문항을 A4 시험지로 출력합니다.",
};

type Props = {
  searchParams: {
    grade?: string | string[];
    school?: string | string[];
    topic?: string | string[];
    mode?: string | string[];
    dims?: string | string[];
    adopted?: string | string[];
    source?: string | string[];
  };
};

function parseMode(
  raw: string | null,
): "structural" | "conceptual" | null {
  if (raw === "structural" || raw === "conceptual") return raw;
  return null;
}

function parseList(raw: string | null): string[] {
  if (raw === null) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function ExportPage({ searchParams }: Props) {
  const schoolLevel = parseSchoolLevel(searchParams.school);
  const grade = parseGrade(searchParams.grade);
  const topic = findTopic(pickFirst(searchParams.topic));
  const mode = parseMode(pickFirst(searchParams.mode));
  const dims = parseList(pickFirst(searchParams.dims));
  const adoptedIds = parseList(pickFirst(searchParams.adopted));
  const sourceProblemText = pickFirst(searchParams.source) ?? "";

  let problems: ResultProblem[] = [];
  if (topic !== null && mode !== null) {
    const all = generateMockResults(topic, mode, dims);
    problems = all.filter((p) => adoptedIds.includes(p.id));
  }

  return (
    <ExportView
      grade={grade}
      schoolLevel={schoolLevel}
      topic={topic}
      mode={mode}
      dims={dims}
      sourceProblemText={sourceProblemText}
      adoptedIds={adoptedIds}
      problems={problems}
    />
  );
}
