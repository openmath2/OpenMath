import { describe, expect, it } from "vitest";

import type { ConstraintCriticAgent, GeneratorAgent, RefinerAgent } from "../src/agents/index.js";
import type { GenerateRequest, GeneratedProblem } from "../src/schemas/index.js";
import { generateProblem } from "../src/steps/problem-generation.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";

const candidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000050",
  mode: "structural",
  generation_kind: "geometry",
  question_text: "삼각형이 닮음일 때 값을 구하시오.",
  expected_answer: "1",
  techniques_used: ["similarity"],
  proposed_solution_trace: "대응 관계를 확인한다.",
  source_refs: ["ref-1"],
  inferred_intent: {
    objective_code: "9수04-04",
    objective_description: "도형의 닮음을 이해한다.",
    evaluation_dimensions: [{ id: "A", description: "대응 관계", must_preserve: true }],
    required_techniques: ["similarity"],
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

const critic: ConstraintCriticAgent = { critique: async () => ({ passes: true, hints: [] }) };

const mathEngine: MathEngineClient = {
  health: async () => ({ status: "ok", engine: "sympy" }),
  solve: async () => ({ solutions: [] }),
  verify: async () => ({ equivalent: true, diff: "0" }),
  simplify: async ({ expr }) => ({ simplified: expr }),
  differentiate: async () => ({ derivative: "" }),
  limit: async () => ({ limit: "" }),
};

describe("generateProblem geometry and statistics guards", () => {
  it("replaces similarity perimeter problems with direct corresponding-side problems", async () => {
    const badCandidate: GeneratedProblem = {
      ...candidate,
      question_text: "두 삼각형이 닮음일 때 삼각형 DEF의 둘레의 길이는?",
      expected_answer: "36cm",
    };
    const result = await generateProblem(
      {
        generator: generatorReturning(badCandidate),
        critic,
        refiner: refinerReturning(badCandidate),
        mathEngine,
      },
      inputForTopic("9수04-04", badCandidate),
    );

    expect(result.data.question_text).toContain("대응하는 변");
    expect(result.data.question_text).not.toContain("둘레");
  });

  it("replaces data-summary explanation choices with relative-frequency calculation", async () => {
    const badCandidate: GeneratedProblem = {
      ...candidate,
      generation_kind: "statistics",
      question_text: "다음 설명 중 옳지 않은 것은? ① 도수 설명 ② 상대도수 설명",
      expected_answer: "②",
    };
    const result = await generateProblem(
      {
        generator: generatorReturning(badCandidate),
        critic,
        refiner: refinerReturning(badCandidate),
        mathEngine,
      },
      inputForTopic("9수05-01", badCandidate),
    );

    expect(result.data.question_text).toContain("상대도수");
    expect(result.data.question_text).not.toContain("옳지 않은");
  });
});

function generatorReturning(problem: GeneratedProblem): GeneratorAgent {
  return { generate: async () => problem };
}

function refinerReturning(problem: GeneratedProblem): RefinerAgent {
  return { refine: async () => problem };
}

function inputForTopic(topic: string, problem: GeneratedProblem) {
  const request: GenerateRequest = {
    grade: 2,
    topic,
    topic_name: topic === "9수04-04" ? "도형의 닮음" : "자료의 정리와 해석",
    mode: "structural",
    school_level: "middle",
    dims: ["A"],
    count: 5,
    difficulty: "medium",
    problem_type: "objective",
  };
  return { request, intent: problem.inferred_intent, refs: [], strategy: null, attempt: 1 };
}
