import type { Metadata } from "next";
import { findTopic, parseGrade, pickFirst } from "../topic/data";
import { ResultView } from "./view";

export const metadata: Metadata = {
  title: "결과 — OpenMath",
  description: "검증 통과한 문항을 검토하고 채택합니다.",
};

type Props = {
  searchParams: {
    grade?: string | string[];
    topic?: string | string[];
    mode?: string | string[];
    dims?: string | string[];
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
  const grade = parseGrade(searchParams.grade);
  const topic = findTopic(pickFirst(searchParams.topic));
  const mode = parseMode(pickFirst(searchParams.mode));
  const dims = parseDims(pickFirst(searchParams.dims));

  /* OM-42: server component 는 sessionStorage 접근 불가 → 빈 배열만 전달.
   * 실제 데이터는 client 측 ResultView 가 useEffect 로 sessionStorage 에서 로드. */
  return (
    <ResultView
      grade={grade}
      topic={topic}
      mode={mode}
      dims={dims}
      problems={[]}
    />
  );
}
