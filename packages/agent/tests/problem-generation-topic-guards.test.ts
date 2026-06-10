import { describe, expect, it } from "vitest";

import type {
  ConstraintCriticAgent,
  GeneratorAgent,
  RefinerAgent,
} from "../src/agents/index.js";
import type { GenerateRequest, GeneratedProblem } from "../src/schemas/index.js";
import { generateProblem } from "../src/steps/problem-generation.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";

const candidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000020",
  mode: "structural",
  generation_kind: "expression",
  question_text: "다음 식을 계산하시오.",
  expected_answer: "1",
  techniques_used: ["calculation"],
  proposed_solution_trace: "식을 정리한다.",
  source_refs: ["ref-1"],
  inferred_intent: {
    objective_code: "9수01-06",
    objective_description: "근호를 포함한 식의 계산",
    evaluation_dimensions: [{ id: "A", description: "계산", must_preserve: true }],
    required_techniques: ["calculation"],
    forbidden_techniques: [],
    surface_constraints: { difficulty: "medium", problem_type: "objective" },
  },
  generation_metadata: {
    model: "test",
    temperature: 0,
    prompt_id: "test",
    prompt_version: "0.0.0",
    attempt: 1,
    generated_at: "2026-06-06T00:00:00.000Z",
  },
};

const critic: ConstraintCriticAgent = {
  critique: async () => ({ passes: true, hints: [] }),
};

const mathEngine: MathEngineClient = {
  health: async () => ({ status: "ok", engine: "sympy" }),
  solve: async () => ({ solutions: [] }),
  verify: async () => ({ equivalent: true, diff: "0" }),
  simplify: async ({ expr }) => ({ simplified: expr }),
  differentiate: async () => ({ derivative: "" }),
  limit: async () => ({ limit: "" }),
};

describe("generateProblem deterministic topic guards", () => {
  it("refines radical calculation candidates that use compound a-b substitutions", async () => {
    const badCandidate: GeneratedProblem = {
      ...candidate,
      question_text: "a = sqrt(7) + 2sqrt(5), b = sqrt(35) - 1일 때, sqrt(7)a - sqrt(35)b의 값을 구하시오.",
      expected_answer: "-8 + 3sqrt(35)",
    };
    const goodCandidate: GeneratedProblem = {
      ...badCandidate,
      question_text: "다음 식을 간단히 하시오. 3sqrt(20) - sqrt(45) + 2sqrt(5)",
      expected_answer: "5sqrt(5)",
    };
    const hints: string[] = [];

    const result = await generateProblem(
      {
        generator: generatorReturning(badCandidate),
        critic,
        refiner: refinerReturning(goodCandidate, hints),
        mathEngine,
      },
      inputForTopic("9수01-06", badCandidate),
    );

    expect(result.data.question_text).toContain("\\sqrt{20}");
    expect(hints.join("\n")).toContain("근호");
  });

  it("refines common-factor candidates into direct factorization", async () => {
    const badCandidate: GeneratedProblem = {
      ...candidate,
      question_text: "두 다항식 6x**2 - x - 15, 9x**2 - 25를 인수분해하였을 때 공통으로 들어 있는 인수는?",
      expected_answer: "3x + 5",
    };
    const goodCandidate: GeneratedProblem = {
      ...badCandidate,
      question_text: "다항식 6x**2 - x - 15를 인수분해하시오.",
      expected_answer: "(3x - 5)(2x + 3)",
    };

    const result = await generateProblem(
      {
        generator: generatorReturning(badCandidate),
        critic,
        refiner: refinerReturning(goodCandidate, []),
        mathEngine,
      },
      inputForTopic("9수02-08", badCandidate),
    );

    expect(result.data.question_text).not.toContain("공통");
    expect(result.data.question_text).toContain("인수분해");
  });

  it("refines multipart value-expression candidates with incomplete expected answers", async () => {
    const badCandidate: GeneratedProblem = {
      ...candidate,
      question_text: "공책 a권과 볼펜 4자루를 샀다. (1) 지불한 돈을 식으로 나타내어라. (2) a=3일 때 값을 구하여라.",
      expected_answer: "(1500a+3200)원",
    };
    const goodCandidate: GeneratedProblem = {
      ...badCandidate,
      question_text: "공책 a권과 볼펜 4자루를 샀다. 지불한 돈을 a를 사용한 식으로 나타내어라.",
      expected_answer: "1500a+3200원",
    };

    const result = await generateProblem(
      {
        generator: generatorReturning(badCandidate),
        critic,
        refiner: refinerReturning(goodCandidate, []),
        mathEngine,
      },
      inputForTopic("9수02-01", badCandidate),
    );

    expect(result.data.question_text).toContain("연필");
    expect(result.data.question_text).not.toContain("(2)");
  });

  it("replaces multi-statement statistics choices with a direct average problem", async () => {
    const badCandidate: GeneratedProblem = {
      ...candidate,
      generation_kind: "statistics",
      question_text: "다음 <보기> 중 옳은 것을 모두 고른 것은? ㉠ 평균은 대푯값이다. ① ㉠",
      expected_answer: "①",
    };

    const result = await generateProblem(
      {
        generator: generatorReturning(badCandidate),
        critic,
        refiner: refinerReturning(badCandidate, []),
        mathEngine,
      },
      inputForTopic("9수05-03", badCandidate),
    );

    expect(result.data.question_text).toContain("평균");
    expect(result.data.question_text).not.toContain("<보기>");
  });

  it("replaces data-summary false-choice questions with direct relative-frequency calculation", async () => {
    const badCandidate: GeneratedProblem = {
      ...candidate,
      generation_kind: "statistics",
      question_text: "다음 중 옳지 않은 것은? ① 변량 설명 ② 도수 설명",
      expected_answer: "②",
    };

    const result = await generateProblem(
      {
        generator: generatorReturning(badCandidate),
        critic,
        refiner: refinerReturning(badCandidate, []),
        mathEngine,
      },
      inputForTopic("9수05-01", badCandidate),
    );

    expect(result.data.question_text).toContain("상대도수");
    expect(result.data.question_text).not.toContain("옳지 않은");
  });

  it("replaces equation verification add-ons with a plain solve problem", async () => {
    const badCandidate: GeneratedProblem = {
      ...candidate,
      generation_kind: "equation",
      question_text: "다음 이차방정식 (3x+2)(x-5)=0의 해를 구하고, x=-2/3가 해인지 확인하시오.",
      expected_answer: "x=-2/3 또는 x=5; x=-2/3는 해",
    };

    const result = await generateProblem(
      {
        generator: generatorReturning(badCandidate),
        critic,
        refiner: refinerReturning(badCandidate, []),
        mathEngine,
      },
      inputForTopic("9수02-09", badCandidate),
    );

    expect(result.data.question_text).toContain("해를 구하시오");
    expect(result.data.question_text).not.toContain("확인");
  });
});

function generatorReturning(problem: GeneratedProblem): GeneratorAgent {
  return { generate: async () => problem };
}

function refinerReturning(problem: GeneratedProblem, hints: string[]): RefinerAgent {
  return {
    refine: async (input) => {
      hints.push(...input.hints);
      return problem;
    },
  };
}

function inputForTopic(topic: string, problem: GeneratedProblem) {
  const request: GenerateRequest = {
    grade: topic === "9수02-08" ? 3 : 3,
    topic,
    topic_name: topic === "9수02-08" ? "다항식의 곱셈과 인수분해" : "근호를 포함한 식의 계산",
    mode: "structural",
    school_level: "middle",
    dims: ["A"],
    count: 5,
    difficulty: "medium",
    problem_type: "objective",
  };
  return {
    request,
    intent: problem.inferred_intent,
    refs: [],
    strategy: null,
    attempt: 1,
  };
}
