import { describe, expect, it } from "vitest";

import type { SolverAgent } from "../src/agents/index.js";
import type { GeneratedProblem } from "../src/schemas/index.js";
import { independentResolve } from "../src/steps/independent-resolve.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";

const candidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000041",
  mode: "structural",
  generation_kind: "geometry",
  question_text: "값을 구하시오.",
  expected_answer: "13cm, 90도",
  proposed_solution_trace: "성질을 이용한다.",
  source_refs: ["ref-1"],
  inferred_intent: {
    objective_code: "9수04-03",
    objective_description: "사각형의 성질을 이해한다.",
    evaluation_dimensions: [{ id: "A", description: "도형 성질", must_preserve: true }],
    required_techniques: ["geometry"],
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
  verify: async () => ({ equivalent: false, diff: "not checked" }),
  simplify: async ({ expr }) => ({ simplified: expr.replace(/\s+/g, "") }),
  differentiate: async () => ({ derivative: "" }),
  limit: async () => ({ limit: "" }),
};

describe("independentResolve geometry and function equivalence", () => {
  it("passes geometry answers when the solver keeps segment and angle labels", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "AB = 13cm, ∠AOB = 90도",
        trace: "마름모의 대각선 성질을 사용한다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      { candidate, sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 } },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes quadratic opening answers when the solver gives only the direction", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "아래로",
        trace: "이차항의 계수가 음수이다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: { ...candidate, generation_kind: "function", expected_answer: "아래로 열린다" },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes tangent-position wording variants for circle and line relations", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "접한다(한 점에서 만난다)",
        trace: "중심에서 직선까지의 거리가 반지름과 같다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: { ...candidate, expected_answer: "한 점에서 만난다" },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });
});
