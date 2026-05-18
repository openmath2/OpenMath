import { describe, expect, it } from "vitest";

import {
  IntentSchema,
  VerificationSchema,
  assertVerificationInvariants,
} from "../src/schemas/index.js";

describe("schemas/intent", () => {
  it("rejects missing evaluation_dimensions (I-I1)", () => {
    const parsed = IntentSchema.safeParse({
      objective_code: "9수04-12",
      objective_description: "이차방정식의 풀이",
      evaluation_dimensions: [],
      required_techniques: ["인수분해"],
      forbidden_techniques: [],
      surface_constraints: {
        difficulty: "medium",
        problem_type: "objective",
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid objective code pattern (I-I3)", () => {
    const parsed = IntentSchema.safeParse({
      objective_code: "INVALID",
      objective_description: "x",
      evaluation_dimensions: [{ id: "A", description: "x", must_preserve: true }],
      required_techniques: [],
      forbidden_techniques: [],
      surface_constraints: { difficulty: "easy", problem_type: "essay" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("schemas/verification invariants", () => {
  const baseGates = ["rag", "intent", "generate", "sympy_verify", "re_solve", "objective_map"].map(
    (step) => ({ step, status: "passed" as const, duration_ms: 100 }),
  );

  it("I-V1: requires exactly 6 gates", () => {
    const parsed = VerificationSchema.safeParse({
      candidate_id: "00000000-0000-0000-0000-000000000000",
      overall: "verified",
      gates: baseGates.slice(0, 5),
      attempt_count: 1,
    });
    expect(parsed.success).toBe(false);
  });

  it("I-V2/I-V3: sympy_verify failed forbids overall=verified", () => {
    const gates = [...baseGates];
    gates[3] = { ...gates[3], status: "failed" };
    expect(() =>
      assertVerificationInvariants({
        candidate_id: "00000000-0000-0000-0000-000000000000",
        overall: "verified",
        gates,
        attempt_count: 1,
      }),
    ).toThrow(/I-V[23]/);
  });

  it("I-V5: attempt_count > 3 must be rejected", () => {
    expect(() =>
      assertVerificationInvariants({
        candidate_id: "00000000-0000-0000-0000-000000000000",
        overall: "verified",
        gates: baseGates,
        attempt_count: 4,
      }),
    ).toThrow(/I-V5/);
  });
});
