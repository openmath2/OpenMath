import { describe, expect, it } from "vitest";

import type { SolverAgent } from "../src/agents/index.js";
import type { GeneratedProblem } from "../src/schemas/index.js";
import { independentResolve } from "../src/steps/independent-resolve.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";

const candidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000010",
  mode: "structural",
  generation_kind: "expression",
  question_text: "다음 중 옳은 것을 고르시오.",
  expected_answer: "3번",
  proposed_solution_trace: "선택지를 비교한다.",
  source_refs: ["ref-1"],
  inferred_intent: {
    objective_code: "9수01-02",
    objective_description: "정수와 유리수를 이해한다.",
    evaluation_dimensions: [{ id: "A", description: "선택지 판별", must_preserve: true }],
    required_techniques: ["choice_selection"],
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

describe("independentResolve choice label equivalence", () => {
  it("passes when a selected parenthesized choice is written as a Korean choice number", async () => {
    const solver: SolverAgent = {
      solve: async () => ({ derived_answer: "(3)", trace: "정답은 (3)이다.", confidence: "high" }),
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

  it("passes when a parenthesized choice answer includes the selected body text", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "(4) 0.101001000100001...",
        trace: "순환하지 않는 무한소수이므로 유리수가 아니다.",
        confidence: "high",
      }),
    };

    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          expected_answer: "④",
          question_text: "다음 중 유리수가 아닌 것은? (1) -3/8 (2) 0.45 (3) 2.131313... (4) 0.101001000100001... (5) -7",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );

    expect(result.gate.status).toBe("passed");
  });
});
