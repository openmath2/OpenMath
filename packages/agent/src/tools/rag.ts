import { tool } from "@openai/agents";
import { z } from "zod";

export const searchSimilarProblems = tool({
  name: "search_similar_problems",
  description:
    "주어진 조건에 맞는 유사 기출문제를 검색합니다. RAG 하이브리드 검색을 사용합니다.",
  parameters: z.object({
    topic: z.string().describe("단원명 또는 성취기준코드"),
    schoolLevel: z.enum(["elementary", "middle", "high"]),
    grade: z.number().min(1).max(12),
    difficulty: z.enum(["easy", "medium", "hard"]).nullable(),
    limit: z.number().min(1).max(10),
  }),
  execute: async () => {
    return JSON.stringify({
      problems: [],
      message: "RAG 검색 미구현 - Cube/PostgreSQL 연동 필요",
    });
  },
});
