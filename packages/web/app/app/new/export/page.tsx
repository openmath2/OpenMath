import type { Metadata } from "next";
import { findTopic, parseGrade, pickFirst } from "../topic/data";
import { ExportView } from "./view";

export const metadata: Metadata = {
  title: "PDF 출력 — OpenMath",
  description: "채택된 문항을 A4 시험지로 출력합니다.",
};

type Props = {
  searchParams: {
    grade?: string | string[];
    topic?: string | string[];
  };
};

export default function ExportPage({ searchParams }: Props) {
  const grade = parseGrade(searchParams.grade);
  const topic = findTopic(pickFirst(searchParams.topic));

  /* OM-42: server component 는 sessionStorage 접근 불가 → 빈 배열만 전달.
   * 실제 채택된 문항은 client 측 ExportView 가 useEffect 로 sessionStorage 에서 로드.
   * 이전엔 URL의 adopted=ID 파라미터로 mock 에서 필터했으나, 이제 result/view.tsx 가
   * 네비게이션 시 saveExportProblems() 로 직접 넘긴다. */
  return <ExportView grade={grade} topic={topic} problems={[]} />;
}
