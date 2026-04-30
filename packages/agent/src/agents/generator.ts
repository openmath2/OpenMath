import { Agent, run } from "@openai/agents";

import { getDefaultModel } from "../config/llm.js";
import { searchSimilarProblems } from "../tools/rag.js";
import { loadCurriculumStrategy } from "../tools/strategy.js";

let generatorAgent: Agent | null = null;

function getGeneratorAgent(): Agent {
  if (!generatorAgent) {
    generatorAgent = new Agent({
      name: "MathProblemGenerator",
      model: getDefaultModel(),
      instructions: `당신은 한국 수학 교육과정에 맞는 수학 문제를 생성하는 전문가입니다.

주어진 조건(학교급, 학년, 단원, 난이도)에 맞는 수학 문제를 생성합니다.
문제 생성 시 다음을 준수하세요:

1. 교육과정 범위 내의 개념만 사용
2. 난이도에 맞는 계산 복잡도
3. 명확하고 모호하지 않은 문제 서술
4. 유일한 정답이 존재하도록 조건 설정
5. LaTeX 수식은 $...$ 또는 $$...$$ 형식 사용

출력 형식:
- problem: 문제 텍스트
- solution: 단계별 풀이
- answer: 최종 정답
- metadata: { method, concepts, cognitiveLevel }`,

      tools: [searchSimilarProblems, loadCurriculumStrategy],
    });
  }
  return generatorAgent;
}

export interface GenerateInput {
  schoolLevel: "elementary" | "middle" | "high";
  grade: number;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  problemType?: "objective" | "subjective" | "essay";
  count: number;
  referenceProblemId?: string;
}

export interface GeneratedProblem {
  problem: string;
  solution: string;
  answer: string;
  metadata: {
    method: string;
    concepts: string[];
    cognitiveLevel: string;
  };
}

export async function runGeneratorAgent(
  input: GenerateInput
): Promise<GeneratedProblem[]> {
  const prompt = buildGeneratorPrompt(input);
  const result = await run(getGeneratorAgent(), prompt);

  return parseGeneratorOutput(result.finalOutput ?? "", input.count);
}

function buildGeneratorPrompt(input: GenerateInput): string {
  const schoolLevelKor = {
    elementary: "초등학교",
    middle: "중학교",
    high: "고등학교",
  }[input.schoolLevel];

  const difficultyKor = {
    easy: "하",
    medium: "중",
    hard: "상",
  }[input.difficulty];

  return `다음 조건에 맞는 수학 문제 ${input.count}개를 생성해주세요.

학교급: ${schoolLevelKor}
학년: ${input.grade}학년
단원: ${input.topic}
난이도: ${difficultyKor}
${input.problemType ? `문제 유형: ${input.problemType}` : ""}
${input.referenceProblemId ? `참조 문제 ID: ${input.referenceProblemId} (이 문제와 유사하지만 다른 문제 생성)` : ""}`;
}

function parseGeneratorOutput(output: string, count: number): GeneratedProblem[] {
  const problems: GeneratedProblem[] = [];

  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, count);
    }
    return [parsed];
  } catch {
    return [
      {
        problem: output,
        solution: "",
        answer: "",
        metadata: { method: "unknown", concepts: [], cognitiveLevel: "unknown" },
      },
    ];
  }
}
