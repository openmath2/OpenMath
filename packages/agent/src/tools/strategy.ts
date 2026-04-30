import { tool } from "@openai/agents";
import { z } from "zod";

export const loadCurriculumStrategy = tool({
  name: "load_curriculum_strategy",
  description:
    "성취기준코드에 해당하는 출제전략 YAML을 로드합니다. 문제 유형, 제약조건, 변형 방향 등을 반환합니다.",
  parameters: z.object({
    achievementCode: z
      .string()
      .describe("성취기준코드 (예: [9수02-15])"),
  }),
  execute: async ({ achievementCode }) => {
    return JSON.stringify({
      achievementCode,
      problemTypes: [],
      constraints: [],
      transformDirections: [],
      message: "출제전략 로드 미구현 - YAML 파일 필요",
    });
  },
});
