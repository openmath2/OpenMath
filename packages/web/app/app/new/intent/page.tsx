import type { Metadata } from "next";
import {
  findTopic,
  getEvaluationCandidates,
  parseGrade,
  pickFirst,
} from "../topic/data";
import { IntentPicker } from "./picker";

export const metadata: Metadata = {
  title: "의도 확인 — OpenMath",
  description:
    "동형 모드와 보존해야 하는 평가 차원을 선택합니다. 출제의 핵심 단계.",
};

type Props = {
  searchParams: { grade?: string | string[]; topic?: string | string[] };
};

export default function IntentPage({ searchParams }: Props) {
  const grade = parseGrade(searchParams.grade);
  const topic = findTopic(pickFirst(searchParams.topic));
  const candidates = topic === null ? [] : getEvaluationCandidates(topic);

  return (
    <IntentPicker grade={grade} topic={topic} candidates={candidates} />
  );
}
