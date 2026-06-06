import { describe, expect, it } from "vitest";

import type { GeneratedProblem } from "../src/schemas/index.js";
import { verifyWithSympy } from "../src/steps/sympy-verification.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";

const expressionCandidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000009",
  mode: "structural",
  generation_kind: "expression",
  question_text: "a, b를 사용한 식과 대입한 값을 구하여라.",
  expected_answer: "4 a + 4 b + 270; 526 kcal",
  proposed_solution_trace: "식을 세우고 값을 대입한다.",
  source_refs: ["ref-1"],
  inferred_intent: {
    objective_code: "9수02-01",
    objective_description: "문자를 사용하여 식을 나타내고 식의 값을 구한다.",
    evaluation_dimensions: [{ id: "A", description: "식의 값", must_preserve: true }],
    required_techniques: ["substitution"],
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

describe("verifyWithSympy", () => {
  it("passes expression answers with multiple parts and units", async () => {
    const mathEngine: MathEngineClient = {
      health: async () => ({ status: "ok", engine: "sympy" }),
      solve: async () => ({ solutions: [] }),
      verify: async () => ({ equivalent: true, diff: "0" }),
      simplify: async ({ expr }) => {
        if (expr.includes("kcal") || expr.includes(";")) {
          throw new Error(`unparseable expression: ${expr}`);
        }
        return { simplified: expr.replace(/\s+/g, "") };
      },
      differentiate: async () => ({ derivative: "" }),
      limit: async () => ({ limit: "" }),
    };

    const result = await verifyWithSympy(
      { mathEngine },
      { candidate: expressionCandidate },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("skips textual objective answer bodies for expression candidates", async () => {
    const mathEngine: MathEngineClient = {
      health: async () => ({ status: "ok", engine: "sympy" }),
      solve: async () => ({ solutions: [] }),
      verify: async () => ({ equivalent: true, diff: "0" }),
      simplify: async ({ expr }) => {
        if (/[가-힣]/u.test(expr)) throw new Error(`textual answer: ${expr}`);
        return { simplified: expr };
      },
      differentiate: async () => ({ derivative: "" }),
      limit: async () => ({ limit: "" }),
    };

    const result = await verifyWithSympy(
      { mathEngine },
      {
        candidate: {
          ...expressionCandidate,
          expected_answer: "② 정수가 아닌 유리수는 2개이다.",
        },
      },
    );

    expect(result.gate.status).toBe("passed");
  });
});
