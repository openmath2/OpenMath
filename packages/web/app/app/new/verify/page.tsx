import type { Metadata } from "next";
import { findTopic, parseGrade, parseSchoolLevel, pickFirst } from "../topic/data";
import { VerifyView } from "./view";

export const metadata: Metadata = {
  title: "검증 진행 — OpenMath",
  description: "생성과 검증을 6 단계로 진행합니다. 실시간 진행 상태를 노출합니다.",
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

function parseMode(raw: string | null): "structural" | "conceptual" | null {
  if (raw === "structural" || raw === "conceptual") return raw;
  return null;
}

export default function VerifyPage({ searchParams }: Props) {
  const schoolLevel = parseSchoolLevel(searchParams.school);
  const grade = parseGrade(searchParams.grade);
  const topic = findTopic(pickFirst(searchParams.topic));
  const mode = parseMode(pickFirst(searchParams.mode));
  const srcRef = pickFirst(searchParams.srcRef) ?? "";

  return (
    <VerifyView
      grade={grade}
      schoolLevel={schoolLevel}
      topic={topic}
      mode={mode}
      srcRef={srcRef}
    />
  );
}
