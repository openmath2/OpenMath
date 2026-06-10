import type { Metadata } from "next";
import { findTopic, parseGrade, parseSchoolLevel, pickFirst } from "../topic/data";
import {
  getSourceProblems,
  type SourceProblem,
} from "@/lib/source-problems-client";
import { IntentPicker } from "./picker";

export const metadata: Metadata = {
  title: "의도 확인 — OpenMath",
  description: "동형 모드와 기준 문항을 선택합니다. 출제의 핵심 단계.",
};

type Props = {
  searchParams: {
    school?: string | string[];
    grade?: string | string[];
    topic?: string | string[];
  };
};

export default async function IntentPage({ searchParams }: Props) {
  const schoolLevel = parseSchoolLevel(searchParams.school);
  const grade = parseGrade(searchParams.grade);
  const topic = findTopic(pickFirst(searchParams.topic));

  let candidates: SourceProblem[] = [];
  if (topic !== null) {
    candidates = await getSourceProblems({
      schoolLevel,
      grade,
      topicCode: topic.code,
      limit: 30,
    });
  }

  return (
    <IntentPicker
      schoolLevel={schoolLevel}
      grade={grade}
      topic={topic}
      candidates={candidates}
    />
  );
}
