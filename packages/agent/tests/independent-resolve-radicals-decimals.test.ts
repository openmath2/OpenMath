import { describe, expect, it } from "vitest";

import type { SolverAgent } from "../src/agents/index.js";
import type { GeneratedProblem } from "../src/schemas/index.js";
import { independentResolve } from "../src/steps/independent-resolve.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";

const candidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000010",
  mode: "structural",
  generation_kind: "expression",
  question_text: "제곱근을 정리하시오.",
  expected_answer: "2 sqrt(7)",
  proposed_solution_trace: "근호를 정리한다.",
  source_refs: ["ref-1"],
  inferred_intent: {
    objective_code: "9수01-05",
    objective_description: "제곱근과 실수를 이해한다.",
    evaluation_dimensions: [{ id: "A", description: "근호 정리", must_preserve: true }],
    required_techniques: ["radical_simplification"],
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

describe("independentResolve radical and repeating-decimal equivalence", () => {
  it("passes when equivalent radical answers use latex and plain sqrt notation", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "12+8sqrt(3)",
        trace: "삼각비로 길이를 구한다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: { ...candidate, generation_kind: "geometry", expected_answer: "12+8 \\sqrt{3}" },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("passes when radical answers omit sqrt parentheses", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "2sqrt7",
        trace: "제곱근을 정리한다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: { ...candidate, expected_answer: "2 \\sqrt{7}" },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("passes repeating-decimal conversion when deterministic fraction matches expected", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "3437/1110",
        trace: "계산 실수로 분모를 잘못 두었다.",
        confidence: "medium",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          expected_answer: "3437/1100",
          question_text: "순환소수 3.12454545...를 분수로 나타내시오.",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("passes when repeating decimals use dotted and ellipsis notation", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "0.777...",
        trace: "7이 반복된다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: { ...candidate, expected_answer: "0.(7)", question_text: "기약분수 7/9을 순환소수로 나타내시오." },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });
});
