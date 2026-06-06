import { describe, expect, it } from "vitest";

import type { SolverAgent } from "../src/agents/index.js";
import type { GeneratedProblem } from "../src/schemas/index.js";
import { independentResolve } from "../src/steps/independent-resolve.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";

const candidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000008",
  mode: "structural",
  generation_kind: "expression",
  question_text:
    "다음 중 두 다항식 4 x^{2} - 4 x - 15, 6 x^{2} - 11 x - 10의 공통 인수는? ① 2 x+3 ② 2 x-5 ③ 3 x+2 ④ x-5 ⑤ x+3",
  expected_answer: "②",
  proposed_solution_trace: "두 다항식을 인수분해하면 공통 인수는 2x-5이다.",
  source_refs: ["ref-1"],
  inferred_intent: {
    objective_code: "9수02-08",
    objective_description: "다항식의 곱셈공식과 인수분해 공식을 이해한다.",
    evaluation_dimensions: [{ id: "A", description: "인수분해", must_preserve: true }],
    required_techniques: ["factorization"],
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

const mathEngine: MathEngineClient = {
  health: async () => ({ status: "ok", engine: "sympy" }),
  solve: async () => ({ solutions: [] }),
  verify: async () => ({ equivalent: true, diff: "0" }),
  simplify: async ({ expr }) => ({ simplified: expr.replace(/\s+/g, "") }),
  differentiate: async () => ({ derivative: "" }),
  limit: async () => ({ limit: "" }),
};

describe("independentResolve", () => {
  it("passes when a solver derives the selected multiple-choice expression", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "2x - 5",
        trace: "공통 인수는 2x-5이므로 ②이다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate,
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("passes when parenthesized choices use a circled answer label with expression text", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "2x - 3",
        trace: "공통 인수는 2x-3이다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          question_text:
            "다음 두 다항식의 공통 인수를 고르시오.\n(1) x - 4\n(2) x + 4\n(3) 2x - 3\n(4) 3x + 1\n(5) 2x + 3",
          expected_answer: "③ 2x - 3",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("passes when a solver derives the zero of the selected linear factor", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "x = 3/2",
        trace: "2x-3=0에서 x=3/2이다.",
        confidence: "high",
      }),
    };
    const rootMathEngine: MathEngineClient = {
      ...mathEngine,
      solve: async ({ equation }) => ({
        solutions: equation.replace(/\s+/g, "") === "2x-3=0" ? ["3/2"] : [],
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine: rootMathEngine },
      {
        candidate: {
          ...candidate,
          question_text:
            "다음 중 두 다항식의 공통 인수는?\n① x - 3 ② x + 3 ③ 2x - 3 ④ 2x + 3 ⑤ 3x - 1",
          expected_answer: "③",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("passes when a solver prefixes a matching expression with a choice label", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "② 2x + 1",
        trace: "공통 인수는 2x+1이다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          expected_answer: "2x + 1",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("passes when a solver appends a Korean counting unit to a numeric answer", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "18모둠",
        trace: "최대공약수는 18이므로 18모둠이다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          expected_answer: "18",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("passes when a solver adds numbered labels and units to multipart expression answers", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "(1) 4a + 4b + 270 kcal\n(2) 526 kcal",
        trace: "식을 세운 뒤 값을 대입한다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          expected_answer: "4 a + 4 b + 270; 526",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("passes when a solver prefixes matching choice details with the selected label", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "③ ㄷ, ㄹ",
        trace: "정답은 ③이다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          expected_answer: "③",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("passes when additive law names omit the additive qualifier", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "교환법칙, 결합법칙",
        trace: "순서대로 교환법칙과 결합법칙이다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          expected_answer: "덧셈의 교환법칙, 덧셈의 결합법칙",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("passes when a solver gives the body of the selected function choice", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "y = -3/2 x",
        trace: "기울기가 -3/2이다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          question_text:
            "이 함수의 식은? ① y = 3/2 x ② y = -3/2 x ③ y = -2 x ④ y = 2/3 x ⑤ y = -1/2 x",
          expected_answer: "②",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("passes when a solver uses a numeric label for a circled expected choice", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "4번",
        trace: "정답은 4번이다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          expected_answer: "④",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });
});
