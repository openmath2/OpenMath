import { describe, expect, it } from "vitest";

import type { GateResult, GeneratedProblem } from "../src/schemas/index.js";
import { createAcceptancePolicy } from "../src/policies/index.js";
import { verifyWithSympy } from "../src/steps/sympy-verification.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";

const expressionCandidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000009",
  mode: "structural",
  generation_kind: "expression",
  question_text: "a, b를 사용한 식과 대입한 값을 구하여라.",
  expected_answer: "4 a + 4 b + 270; 526 kcal",
  techniques_used: ["substitution"],
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
  it("marks expression answers with units as unverified instead of syntax-only passed", async () => {
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

    expect(result.gate.status).toBe("unverified");
    expect(result.gate.evidence).toMatchObject({
      reason: expect.stringContaining("requires a checkable equation"),
    });
  });

  it("marks textual objective answer bodies as unverified instead of non-empty passed", async () => {
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

    expect(result.gate.status).toBe("unverified");
  });

  it("fails a wrong expected equation answer so acceptance rejects the final verdict", async () => {
    const mathEngine = createEquationMathEngine({ solutions: ["2", "3"] });

    const result = await verifyWithSympy(
      { mathEngine },
      {
        candidate: {
          ...expressionCandidate,
          generation_kind: "equation",
          question_text: "다음 방정식을 풀어라. x**2 - 5*x + 6 = 0",
          expected_answer: "1, 6",
        },
      },
    );
    const gates = passedGates().map((gate) =>
      gate.step === "sympy_verify" ? result.gate : gate,
    );

    expect(result.gate.status).toBe("failed");
    expect(createAcceptancePolicy().decide(gates, 3)).toBe("rejected");
  });

  it("marks equation candidates with no extractable equation as unverified instead of failed", async () => {
    const mathEngine: MathEngineClient = {
      health: async () => ({ status: "ok", engine: "sympy" }),
      solve: async () => {
        throw new Error("solve should not be called when extraction fails");
      },
      verify: async () => ({ equivalent: true, diff: "0" }),
      simplify: async ({ expr }) => ({ simplified: expr.replace(/\s+/g, "") }),
      differentiate: async () => ({ derivative: "" }),
      limit: async () => ({ limit: "" }),
    };

    const result = await verifyWithSympy(
      { mathEngine },
      {
        candidate: {
          ...expressionCandidate,
          generation_kind: "equation",
          question_text: "다음 문장제의 조건을 읽고 알맞은 값을 구하시오.",
          expected_answer: "3",
        },
      },
    );

    expect(result.gate.status).toBe("unverified");
    expect(result.gate.failure_detail?.code).toBe("sympy_unverified");
    expect(result.gate.evidence).toMatchObject({
      extraction: "no_extractable_equation",
      reason: expect.stringContaining("extractable equation"),
    });
  });

  it("maps Korean geometry answers SymPy cannot check to warning, never verified", async () => {
    const result = await verifyWithSympy(
      { mathEngine: createEquationMathEngine({ solutions: [] }) },
      {
        candidate: {
          ...expressionCandidate,
          generation_kind: "geometry",
          question_text: "마름모 ABCD에서 대응하는 선분을 쓰시오.",
          expected_answer: "선분 ST",
        },
      },
    );
    const gates = passedGates().map((gate) =>
      gate.step === "sympy_verify" ? result.gate : gate,
    );

    expect(result.gate.status).toBe("unverified");
    expect(createAcceptancePolicy().decide(gates, 1)).toBe("warning");
  });

  it("fails multiple-choice when the labeled correct option does not match SymPy", async () => {
    const result = await verifyWithSympy(
      { mathEngine: createEquationMathEngine({ solutions: ["2"] }) },
      {
        candidate: {
          ...expressionCandidate,
          generation_kind: "equation",
          question_text: "다음 방정식을 풀어라. x - 2 = 0. ① 1 ② 2 ③ 3 ④ 4",
          expected_answer: "④",
          expected_choices: ["① 1", "② 2", "③ 3", "④ 4"],
        },
      },
    );

    expect(result.gate.status).toBe("failed");
    expect(result.gate.failure_detail?.code).toBe("multiple_choice_correct_mismatch");
    expect(result.gate.evidence).toMatchObject({ expected_answer: "4", sympy_answer: "2" });
  });

  it("fails multiple-choice when two options are symbolically equivalent", async () => {
    const result = await verifyWithSympy(
      { mathEngine: createEquationMathEngine({ solutions: ["2", "3"] }) },
      {
        candidate: {
          ...expressionCandidate,
          generation_kind: "equation",
          question_text: "다음 방정식을 풀어라. x**2 - 5*x + 6 = 0. ① 2, 3 ② 1 ③ 1 ④ 4",
          expected_answer: "①",
          expected_choices: ["① 2, 3", "② 1", "③ 1", "④ 4"],
        },
      },
    );

    expect(result.gate.status).toBe("failed");
    expect(result.gate.failure_detail?.code).toBe("multiple_choice_duplicate_equivalent_options");
  });
});

function createEquationMathEngine(opts: { readonly solutions: string[] }): MathEngineClient {
  return {
    health: async () => ({ status: "ok", engine: "sympy" }),
    solve: async () => ({ solutions: opts.solutions }),
    verify: async ({ expr1, expr2 }) => ({
      equivalent: expr1.replace(/\s+/g, "") === expr2.replace(/\s+/g, ""),
      diff: "0",
    }),
    simplify: async ({ expr }) => ({ simplified: expr.replace(/\s+/g, "") }),
    differentiate: async () => ({ derivative: "" }),
    limit: async () => ({ limit: "" }),
  };
}

function passedGates(): GateResult[] {
  return ["rag", "intent", "generate", "sympy_verify", "re_solve", "objective_map"].map(
    (step) => ({ step, status: "passed" as const, duration_ms: 1 }),
  );
}
