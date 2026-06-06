import { describe, expect, it } from "vitest";

import type { SolverAgent } from "../src/agents/index.js";
import type { GeneratedProblem } from "../src/schemas/index.js";
import { independentResolve } from "../src/steps/independent-resolve.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";

const candidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000040",
  mode: "structural",
  generation_kind: "geometry",
  question_text: "대응하는 선분을 쓰시오.",
  expected_answer: "선분 ST",
  proposed_solution_trace: "대응 관계를 확인한다.",
  source_refs: ["ref-1"],
  inferred_intent: {
    objective_code: "9수04-04",
    objective_description: "도형의 닮음을 이해한다.",
    evaluation_dimensions: [{ id: "A", description: "대응 변", must_preserve: true }],
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

const mathEngine: MathEngineClient = {
  health: async () => ({ status: "ok", engine: "sympy" }),
  solve: async () => ({ solutions: [] }),
  verify: async () => ({ equivalent: true, diff: "0" }),
  simplify: async ({ expr }) => ({ simplified: expr.replace(/\s+/g, "") }),
  differentiate: async () => ({ derivative: "" }),
  limit: async () => ({ limit: "" }),
};

describe("independentResolve text equivalence", () => {
  it("passes when a segment answer omits the Korean segment prefix", async () => {
    const solver: SolverAgent = {
      solve: async () => ({ derived_answer: "ST", trace: "대응 변은 ST이다.", confidence: "high" }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      { candidate, sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 } },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes graph point answers when expected uses yes wording", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "점 (-1, 9)는 그래프 위의 점이다. 그래프는 아래로 열린다.",
        trace: "대입하고 계수의 부호를 확인한다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          generation_kind: "function",
          expected_answer: "예, 아래로 열린다",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes graph point answers when expected omits yes wording", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "예, 점 (3, -3)는 그래프 위에 있다. 그래프는 꼭짓점이 (1, 5)이고 아래로 열린 포물선이다.",
        trace: "대입하고 계수의 부호를 확인한다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine: { ...mathEngine, verify: async () => ({ equivalent: false, diff: "not checked" }) } },
      {
        candidate: {
          ...candidate,
          generation_kind: "function",
          expected_answer: "그래프 위에 있다, 아래로 열린다",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes linear-function trend wording variants", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "예, 오른쪽 아래, x가 증가하면 y는 감소",
        trace: "기울기가 음수이므로 감소한다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          generation_kind: "function",
          expected_answer: "예, 오른쪽 아래, 감소",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes fraction answers with decimal and percent notes", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "1/5 (0.2, 20%)",
        trace: "8/40을 약분한다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          generation_kind: "statistics",
          expected_answer: "1/5",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes fraction answers when the solver gives only an equivalent decimal", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "0.2",
        trace: "8/40=0.2이다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          generation_kind: "statistics",
          expected_answer: "1/5",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes prime-factor answers when the solver writes sentence labels", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "소인수는 2, 3, 5이고, N의 약수의 개수는 36개이다.",
        trace: "지수를 이용해 약수의 개수를 구한다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          generation_kind: "factorization",
          expected_answer: "2, 3, 5; 36",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes system answers when the solver omits variable labels in order", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "3, 2",
        trace: "연립방정식의 해는 x=3, y=2이다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          generation_kind: "equation",
          expected_answer: "x=3, y=2",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes ordered radical answers when expected uses an inequality chain", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "4, sqrt(50)-3, sqrt(18)+1",
        trace: "각 값을 비교해 작은 것부터 나열한다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine: { ...mathEngine, verify: async () => ({ equivalent: false, diff: "not checked" }) } },
      {
        candidate: {
          ...candidate,
          question_text: "다음 세 수를 작은 것부터 큰 것 순서로 나열하시오: \\sqrt{50}-3, 4, \\sqrt{18}+1",
          expected_answer: "4 < \\sqrt{50}-3 < \\sqrt{18}+1",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes not-real wording when the solver adds Korean particles", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "실수 범위에서는 정의되지 않음",
        trace: "근호 안이 음수이다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine: { ...mathEngine, verify: async () => ({ equivalent: false, diff: "not checked" }) } },
      {
        candidate: {
          ...candidate,
          expected_answer: "실수가 아니다",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

});
