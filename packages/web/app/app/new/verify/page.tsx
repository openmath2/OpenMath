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

export default function VerifyPage({ searchParams }: Props) {
  const grade = parseGrade(searchParams.grade);
  const topic = findTopic(pickFirst(searchParams.topic));
  const mode = parseMode(pickFirst(searchParams.mode));
  const dims = parseDims(pickFirst(searchParams.dims));

  return (
    <VerifyView grade={grade} topic={topic} mode={mode} dims={dims} />
  );
}
