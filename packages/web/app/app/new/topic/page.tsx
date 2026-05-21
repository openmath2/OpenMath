import type { Metadata } from "next";
import { parseGrade } from "./data";
import { TopicPicker } from "./picker";

export const metadata: Metadata = {
  title: "단원 선택 — OpenMath",
  description:
    "성취기준 단원을 선택하세요. 2022 개정 교육과정에 따라 학년별 단원으로 정렬됩니다.",
};

type Props = {
  searchParams: { grade?: string | string[] };
};

export default function TopicPage({ searchParams }: Props) {
  const grade = parseGrade(searchParams.grade);
  return <TopicPicker grade={grade} />;
}
