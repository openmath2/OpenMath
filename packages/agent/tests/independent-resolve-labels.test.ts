import { describe, expect, it } from "vitest";

import type { SolverAgent } from "../src/agents/index.js";
import type { GeneratedProblem } from "../src/schemas/index.js";
import { independentResolve } from "../src/steps/independent-resolve.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";

const candidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000010",
  mode: "structural",
  generation_kind: "expression",
  question_text: "계산 과정 ㈎, ㈏에 쓰인 법칙을 쓰시오.",
  expected_answer: "덧셈의 교환법칙, 덧셈의 결합법칙",
  techniques_used: ["addition_laws"],
  proposed_solution_trace: "순서대로 교환법칙과 결합법칙이다.",
  source_refs: ["ref-1"],
  inferred_intent: {
    objective_code: "9수02-02",
    objective_description: "일차식의 계산 원리를 이해한다.",
    evaluation_dimensions: [{ id: "A", description: "계산 법칙", must_preserve: true }],
    required_techniques: ["addition_laws"],
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

describe("independentResolve label normalization", () => {
  it("passes when law names include Korean process labels", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "㈎ 교환법칙, ㈏ 결합법칙",
        trace: "순서대로 교환법칙과 결합법칙이다.",
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

  it("passes equivalent function formulas with explicit multiplication", async () => {
    const solver: SolverAgent = {
      solve: async () => ({ derived_answer: "y = -5/2*x", trace: "기울기를 구한다.", confidence: "high" }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: { ...candidate, generation_kind: "function", expected_answer: "y = -5/2 x" },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes equivalent not-real answer wording", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "실수 범위에서 정의되지 않음",
        trace: "근호 안이 음수이다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: { ...candidate, expected_answer: "실수가 아니다" },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("ignores rejected non-solution notes in derived equation answers", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "x = 3/4, -1/2; x = -3/4는 해가 아님",
        trace: "두 해를 구하고 다른 값은 해가 아님을 확인한다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: { ...candidate, generation_kind: "equation", expected_answer: "-1/2, 3/4" },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes when a numeric value is prefixed by Korean answer text", async () => {
    const solver: SolverAgent = {
      solve: async () => ({ derived_answer: "식의 값은 -5/3", trace: "계산한다.", confidence: "high" }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: { ...candidate, expected_answer: "-5/3" },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes expression-and-value answers when derived answer keeps numbered labels and won units", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "(1) 1500a + 900b + 3600원\n(2) 15900원",
        trace: "항목별 가격을 식으로 나타낸 뒤 대입한다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          expected_answer: "1500 a + 900 b + 3600, 15900원",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes prime-factor answers when derived text includes Korean field labels", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "소인수: 2, 3, 5; 약수의 개수: 24개",
        trace: "360을 소인수분해하고 약수 개수를 센다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: { ...candidate, expected_answer: "2, 3, 5; 24개" },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes quadratic graph shape wording variants", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "㉠, ㉡ / 아래로 열린 포물선",
        trace: "계수 a가 음수이므로 아래로 열린다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: {
          ...candidate,
          generation_kind: "function",
          expected_answer: "㉠, ㉡, 아래로 열린다",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes graph point and opening wording variants in sentence form", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "예, 점 (2, -12)는 그래프 위의 점이고, 그래프는 아래로 열린다.",
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
          expected_answer: "그래프 위의 점이며, 아래로 열린다.",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes geometry pair answers when derived text includes Korean labels", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "변 AB의 길이는 13cm, 각 AOB의 크기는 90도",
        trace: "마름모의 대각선은 서로 수직이등분하므로 피타고라스 정리를 쓴다.",
        confidence: "high",
      }),
    };
    const result = await independentResolve(
      { solver, mathEngine },
      {
        candidate: { ...candidate, generation_kind: "geometry", expected_answer: "13cm, 90도" },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("passes equation candidates when deterministic solving confirms the expected answer", async () => {
    const solver: SolverAgent = {
      solve: async () => ({
        derived_answer: "5/2, -3/2",
        trace: "계산 실수로 다른 해를 얻었다.",
        confidence: "medium",
      }),
    };
    const result = await independentResolve(
      {
        solver,
        mathEngine: {
          ...mathEngine,
          solve: async () => ({ solutions: ["-1/8 + sqrt(241)/8", "-sqrt(241)/8 - 1/8"] }),
        },
      },
      {
        candidate: {
          ...candidate,
          generation_kind: "equation",
          question_text: "다음 이차방정식을 풀어라. 4*x**2 + 3*x = 2*x + 15",
          expected_answer: "-1/8 + sqrt(241)/8, -sqrt(241)/8 - 1/8",
        },
        sympyGate: { step: "sympy_verify", status: "passed", duration_ms: 1 },
      },
    );
    expect(result.gate.status).toBe("passed");
  });
});
