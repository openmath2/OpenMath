import { describe, expect, it } from "vitest";

import type {
  GateResult,
  GeneratedProblem,
  Verification,
} from "../src/schemas/index.js";
import {
  WireResultProblemSchema,
} from "../src/schemas/index.js";
import { toWireResultProblem } from "../src/server/sse/wire-adapter.js";

const baseProblem: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000010",
  mode: "structural",
  generation_kind: "equation",
  question_text: "x**2 - 5*x + 6 = 0",
  expected_answer: "2, 3",
  techniques_used: ["factorization"],
  proposed_solution_trace: "(x - 2)(x - 3) = 0",
  source_refs: ["seed-9수02-09-001"],
  inferred_intent: {
    objective_code: "9수02-09",
    objective_description: "이차방정식을 풀 수 있다",
    evaluation_dimensions: [
      {
        id: "A",
        description: "이차식을 인수분해하여 해를 구한다",
        must_preserve: true,
      },
      {
        id: "B",
        description: "근의 공식의 적용 흐름을 설명한다",
        must_preserve: false,
      },
    ],
    required_techniques: ["factorization"],
    forbidden_techniques: [],
    surface_constraints: { difficulty: "easy", problem_type: "short_answer" },
  },
  generation_metadata: {
    model: "gpt-5.5(xhigh)",
    temperature: 0.4,
    prompt_id: "problem-generator",
    prompt_version: "0.3.0",
    attempt: 2,
    generated_at: "2026-05-21T00:00:00.000Z",
    refined_by: ["constraint-critic", "refiner"],
  },
};

function makeVerification(overrides?: Partial<Verification>): Verification {
  const gates: GateResult[] = [
    { step: "rag", status: "passed", duration_ms: 12 },
    { step: "intent", status: "passed", duration_ms: 34 },
    { step: "generate", status: "passed", duration_ms: 880 },
    { step: "sympy_verify", status: "passed", duration_ms: 56 },
    {
      step: "re_solve",
      status: "failed",
      duration_ms: 410,
      failure_detail: {
        code: "re_solve_mismatch",
        message: "Independent resolve disagreed with expected answer",
      },
    },
    { step: "objective_map", status: "passed", duration_ms: 21 },
  ];
  return {
    candidate_id: baseProblem.candidate_id,
    overall: "warning",
    gates,
    attempt_count: 2,
    ...overrides,
  };
}

describe("toWireResultProblem — verification + provenance projection", () => {
  it("projects overall, gates, attempt_count, model, and refined_by", () => {
    const verification = makeVerification();

    const wire = toWireResultProblem(baseProblem, verification);

    expect(wire.overall).toBe("warning");
    expect(wire.verification_status).toBe("partial");
    expect(wire.attempt_count).toBe(2);
    expect(wire.generation_model).toBe("gpt-5.5(xhigh)");
    expect(wire.refined_by).toEqual(["constraint-critic", "refiner"]);

    expect(wire.gates).toHaveLength(6);
    expect(wire.gates.map((g) => g.step)).toEqual([
      "rag",
      "intent",
      "generate",
      "sympy_verify",
      "re_solve",
      "objective_map",
    ]);
    expect(wire.gates[0]).toEqual({
      step: "rag",
      status: "passed",
      duration_ms: 12,
    });
    expect(wire.gates[4]).toEqual({
      step: "re_solve",
      status: "failed",
      duration_ms: 410,
      failure_code: "re_solve_mismatch",
      failure_message: "Independent resolve disagreed with expected answer",
    });
  });

  it("omits failure_code/message on passing gates and emits empty refined_by when absent", () => {
    const problem: GeneratedProblem = {
      ...baseProblem,
      generation_metadata: {
        ...baseProblem.generation_metadata,
        model: "seed",
        refined_by: undefined,
      },
    };
    const verification = makeVerification({
      overall: "verified",
      attempt_count: 1,
      gates: [
        { step: "rag", status: "passed", duration_ms: 1 },
        { step: "intent", status: "passed", duration_ms: 1 },
        { step: "generate", status: "passed", duration_ms: 1 },
        { step: "sympy_verify", status: "passed", duration_ms: 1 },
        { step: "re_solve", status: "passed", duration_ms: 1 },
        { step: "objective_map", status: "passed", duration_ms: 1 },
      ],
    });

    const wire = toWireResultProblem(problem, verification);

    expect(wire.overall).toBe("verified");
    expect(wire.verification_status).toBe("pass");
    expect(wire.generation_model).toBe("seed");
    expect(wire.refined_by).toEqual([]);
    for (const gate of wire.gates) {
      expect(gate.failure_code).toBeUndefined();
      expect(gate.failure_message).toBeUndefined();
    }
  });

  it("keeps the existing public fields stable", () => {
    const wire = toWireResultProblem(baseProblem, makeVerification());

    expect(wire.id).toBe(baseProblem.candidate_id);
    expect(wire.question_latex).toBe(baseProblem.question_text);
    expect(wire.answer_latex).toBe(baseProblem.expected_answer);
    expect(wire.isomorphism).toBe("structural");
    expect(wire.preserved_dimensions).toEqual([
      "이차식을 인수분해하여 해를 구한다",
    ]);
    expect(wire.source_refs).toEqual(["seed-9수02-09-001"]);
    expect(wire.explanation_latex).toBeUndefined();
  });

  it("satisfies WireResultProblemSchema parsing (rejected case)", () => {
    const verification = makeVerification({
      overall: "rejected",
      attempt_count: 4,
      gates: [
        { step: "rag", status: "passed", duration_ms: 1 },
        { step: "intent", status: "passed", duration_ms: 1 },
        { step: "generate", status: "passed", duration_ms: 1 },
        {
          step: "sympy_verify",
          status: "failed",
          duration_ms: 1,
          failure_detail: {
            code: "sympy_solution_set_mismatch",
            message: "Solutions disagreed with declared answer",
          },
        },
        { step: "re_solve", status: "skipped", duration_ms: 0 },
        { step: "objective_map", status: "skipped", duration_ms: 0 },
      ],
    });

    const wire = toWireResultProblem(baseProblem, verification);
    const parsed = WireResultProblemSchema.parse(wire);

    expect(parsed.overall).toBe("rejected");
    expect(parsed.verification_status).toBe("fail");
    expect(parsed.attempt_count).toBe(4);
    expect(parsed.gates[3]?.failure_code).toBe("sympy_solution_set_mismatch");
    expect(parsed.gates[5]?.status).toBe("skipped");
  });
});
