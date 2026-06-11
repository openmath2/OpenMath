import { describe, expect, it } from "vitest";

import type {
  ConstraintCriticAgent,
  GeneratorAgent,
  RefinerAgent,
} from "../src/agents/index.js";
import type { GeneratedProblem } from "../src/schemas/index.js";
import { generateProblem } from "../src/steps/problem-generation.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";

const candidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000010",
  mode: "structural",
  generation_kind: "equation",
  question_text: "다음 방정식을 풀어라. x**2 - 3*x - 10 = 0",
  expected_answer: "5, -2",
  techniques_used: ["quadratic_equation"],
  proposed_solution_trace: "인수분해된 식에서 해를 구한다.",
  source_refs: ["ref-1"],
  inferred_intent: {
    objective_code: "9수02-10",
    objective_description: "이차방정식을 활용하여 문제를 해결한다.",
    evaluation_dimensions: [{ id: "A", description: "이차방정식 활용", must_preserve: true }],
    required_techniques: ["quadratic_equation"],
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

const generator: GeneratorAgent = {
  generate: async () => candidate,
};

const critic: ConstraintCriticAgent = {
  critique: async () => ({ passes: true, hints: [] }),
};

const refiner: RefinerAgent = {
  refine: async () => candidate,
};

const mathEngine: MathEngineClient = {
  health: async () => ({ status: "ok", engine: "sympy" }),
  solve: async () => {
    throw new Error("math-engine rejected extracted equation");
  },
  verify: async () => ({ equivalent: true, diff: "0" }),
  simplify: async ({ expr }) => ({ simplified: expr }),
  differentiate: async () => ({ derivative: "" }),
  limit: async () => ({ limit: "" }),
};

describe("generateProblem", () => {
  it("keeps the generated candidate when equation answer normalization fails", async () => {
    const result = await generateProblem(
      { generator, critic, refiner, mathEngine },
      {
        request: {
          grade: 3,
          topic: "9수02-03",
          topic_name: "일차방정식",
          mode: "structural",
          school_level: "middle",
          dims: ["A"],
          count: 5,
          difficulty: "medium",
          problem_type: "objective",
        },
        intent: candidate.inferred_intent,
        refs: [],
        strategy: null,
        attempt: 1,
      },
    );

    expect(result.gate.status).toBe("passed");
    expect(result.data.expected_answer).toBe("5, -2");
    expect(result.gate.evidence).toMatchObject({
      normalization_skipped_reasons: ["answer normalization skipped: math-engine rejected extracted equation"],
    });
  });

  it("does not normalize answers for choice-style equation candidates", async () => {
    const choiceCandidate: GeneratedProblem = {
      ...candidate,
      question_text: "다음 풀이 과정에 이용된 등식의 성질은? x+1=3 ① ㉠ ② ㉡",
      expected_answer: "②",
    };
    const result = await generateProblem(
      {
        generator: { generate: async () => choiceCandidate },
        critic,
        refiner,
        mathEngine: { ...mathEngine, solve: async () => ({ solutions: ["20/119"] }) },
      },
      {
        request: {
          grade: 1,
          topic: "9수02-03",
          topic_name: "일차방정식",
          mode: "structural",
          school_level: "middle",
          dims: ["A"],
          count: 5,
          difficulty: "medium",
          problem_type: "objective",
        },
        intent: choiceCandidate.inferred_intent,
        refs: [],
        strategy: null,
        attempt: 1,
      },
    );

    expect(result.data.expected_answer).toBe("②");
  });

  it("refines integer-and-rational candidates that drift into radical calculation", async () => {
    const badCandidate: GeneratedProblem = {
      ...candidate,
      generation_kind: "expression",
      question_text: "다음 식을 간단히 하시오. sqrt(18)+sqrt(8)",
      expected_answer: "5*sqrt(2)",
    };
    const goodCandidate: GeneratedProblem = {
      ...badCandidate,
      question_text: "다음 수 중 정수가 아닌 유리수는 몇 개인가? -1/2, 0.3, -4/2, 7",
      expected_answer: "2",
    };
    const hints: string[] = [];

    const result = await generateProblem(
      {
        generator: { generate: async () => badCandidate },
        critic,
        refiner: {
          refine: async (input) => {
            hints.push(...input.hints);
            return goodCandidate;
          },
        },
        mathEngine,
      },
      {
        request: {
          grade: 1,
          topic: "9수01-02",
          topic_name: "정수와 유리수",
          mode: "structural",
          school_level: "middle",
          dims: ["A"],
          count: 5,
          difficulty: "medium",
          problem_type: "objective",
        },
        intent: badCandidate.inferred_intent,
        refs: [],
        strategy: null,
        attempt: 1,
      },
    );

    expect(result.data.question_text).toBe(goodCandidate.question_text);
    expect(hints.join("\n")).toContain("정수와 유리수");
    expect(result.refined_by).toContain("deterministic-topic-guard");
  });

  it("refines repeating-decimal candidates that use overdot choice notation", async () => {
    const badCandidate: GeneratedProblem = {
      ...candidate,
      generation_kind: "expression",
      question_text: "순환소수 0.121212...의 표현으로 옳은 것은? ① 0.1̇2̇ ② 0.12̇",
      expected_answer: "①",
    };
    const goodCandidate: GeneratedProblem = {
      ...badCandidate,
      question_text: "순환소수 0.121212...를 분수로 나타내시오.",
      expected_answer: "4/33",
    };

    const result = await generateProblem(
      {
        generator: { generate: async () => badCandidate },
        critic,
        refiner: { refine: async () => goodCandidate },
        mathEngine,
      },
      {
        request: {
          grade: 2,
          topic: "9수01-04",
          topic_name: "유리수와 순환소수",
          mode: "structural",
          school_level: "middle",
          dims: ["A"],
          count: 5,
          difficulty: "medium",
          problem_type: "objective",
        },
        intent: badCandidate.inferred_intent,
        refs: [],
        strategy: null,
        attempt: 1,
      },
    );

    expect(result.data.question_text).toBe(goodCandidate.question_text);
  });

  it("refines geometry candidates that depend on an unseen figure", async () => {
    const badCandidate: GeneratedProblem = {
      ...candidate,
      generation_kind: "geometry",
      question_text: "오른쪽 그림에서 AB는 원 O의 지름이고 PT는 접선이다. x의 값을 구하시오.",
      expected_answer: "38도",
    };
    const goodCandidate: GeneratedProblem = {
      ...badCandidate,
      question_text: "원 O의 반지름이 5cm이고 중심 O에서 직선 l까지의 거리가 5cm일 때, 원 O와 직선 l의 위치 관계를 쓰시오.",
      expected_answer: "한 점에서 만난다",
    };

    const result = await generateProblem(
      {
        generator: { generate: async () => badCandidate },
        critic,
        refiner: { refine: async () => goodCandidate },
        mathEngine,
      },
      {
        request: {
          grade: 3,
          topic: "9수04-06",
          topic_name: "원과 직선의 위치 관계",
          mode: "structural",
          school_level: "middle",
          dims: ["A"],
          count: 5,
          difficulty: "medium",
          problem_type: "objective",
        },
        intent: badCandidate.inferred_intent,
        refs: [],
        strategy: null,
        attempt: 1,
      },
    );

    expect(result.data.question_text).toBe(goodCandidate.question_text);
  });
});
