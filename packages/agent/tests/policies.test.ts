import { describe, expect, it } from "vitest";

import type { GateResult, Verification } from "../src/schemas/index.js";
import {
  createAcceptancePolicy,
  createBoundedRetryPolicy,
  withTimeout,
} from "../src/policies/index.js";

const passedGates: GateResult[] = [
  "rag",
  "intent",
  "generate",
  "sympy_verify",
  "re_solve",
  "objective_map",
].map((step) => ({ step, status: "passed" as const, duration_ms: 1 }));

describe("acceptance policy", () => {
  it("verifies only when required gates pass", () => {
    const policy = createAcceptancePolicy();
    expect(policy.decide(passedGates, 1)).toBe("verified");
  });

  it("rejects when SymPy fails", () => {
    const policy = createAcceptancePolicy();
    const gates = passedGates.map((gate) =>
      gate.step === "sympy_verify" ? { ...gate, status: "failed" as const } : gate,
    );
    expect(policy.decide(gates, 1)).toBe("rejected");
  });

  it("returns warning for independent re-solve mismatch after SymPy pass", () => {
    const policy = createAcceptancePolicy();
    const gates = passedGates.map((gate) =>
      gate.step === "re_solve" ? { ...gate, status: "failed" as const } : gate,
    );
    expect(policy.decide(gates, 1)).toBe("warning");
  });
});

describe("retry policy", () => {
  it("retries non-verified results until maxAttempts", () => {
    const policy = createBoundedRetryPolicy({ maxAttempts: 3 });
    const verification: Verification = {
      candidate_id: "00000000-0000-0000-0000-000000000002",
      overall: "rejected",
      gates: passedGates,
      attempt_count: 2,
    };
    expect(policy.decide(verification)).toMatchObject({
      shouldRetry: true,
      nextAttempt: 3,
    });
  });

  it("stops at maxAttempts", () => {
    const policy = createBoundedRetryPolicy({ maxAttempts: 3 });
    const verification: Verification = {
      candidate_id: "00000000-0000-0000-0000-000000000003",
      overall: "rejected",
      gates: passedGates,
      attempt_count: 3,
    };
    expect(policy.decide(verification).shouldRetry).toBe(false);
  });
});

describe("timeout policy", () => {
  it("returns a value before timeout", async () => {
    await expect(withTimeout(async () => 42, { ms: 1000, label: "fast" })).resolves.toBe(42);
  });

  it("rejects after timeout", async () => {
    await expect(
      withTimeout(
        () => new Promise((resolve) => setTimeout(() => resolve(42), 50)),
        { ms: 1, label: "slow" },
      ),
    ).rejects.toThrow(/slow timed out/);
  });
});
