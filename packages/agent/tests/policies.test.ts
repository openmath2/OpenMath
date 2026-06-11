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

  it("warns for re-solve mismatch while attempts remain and rejects on the final attempt", () => {
    const policy = createAcceptancePolicy();
    const gates = passedGates.map((gate) =>
      gate.step === "re_solve" ? { ...gate, status: "failed" as const } : gate,
    );
    expect(policy.decide(gates, 1)).toBe("warning");
    expect(policy.decide(gates, 3)).toBe("rejected");
  });

  it("maps unverified SymPy to warning instead of verified", () => {
    const policy = createAcceptancePolicy();
    const gates = passedGates.map((gate) =>
      gate.step === "sympy_verify" ? { ...gate, status: "unverified" as const } : gate,
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

  it("retries re-solve mismatch while attempts remain", () => {
    const policy = createBoundedRetryPolicy({ maxAttempts: 3 });
    const verification: Verification = {
      candidate_id: "00000000-0000-0000-0000-000000000006",
      overall: "warning",
      gates: passedGates.map((gate) =>
        gate.step === "re_solve" ? { ...gate, status: "failed" as const } : gate,
      ),
      attempt_count: 2,
    };

    expect(policy.decide(verification)).toMatchObject({
      shouldRetry: true,
      nextAttempt: 3,
    });
  });

  it("does not retry unverified-only warnings", () => {
    const policy = createBoundedRetryPolicy({ maxAttempts: 3 });
    const verification: Verification = {
      candidate_id: "00000000-0000-0000-0000-000000000007",
      overall: "warning",
      gates: passedGates.map((gate) =>
        gate.step === "sympy_verify" ? { ...gate, status: "unverified" as const } : gate,
      ),
      attempt_count: 1,
    };

    expect(policy.decide(verification).shouldRetry).toBe(false);
  });

  it("emits a SymPy-specific hint and previous-candidate counterexample", () => {
    const policy = createBoundedRetryPolicy({ maxAttempts: 3 });
    const gates: GateResult[] = passedGates.map((gate) => {
      if (gate.step === "generate") {
        return {
          ...gate,
          evidence: {
            question_text: "다음 방정식을 풀어라. x**2 - 5*x + 6 = 0",
            expected_answer: "1, 6",
          },
        };
      }
      if (gate.step === "sympy_verify") {
        return {
          ...gate,
          status: "failed" as const,
          evidence: {
            engine: "sympy",
            expected_answer: "1, 6",
            sympy_answer: "2, 3",
          },
          failure_detail: {
            code: "sympy_solution_mismatch",
            message: "SymPy solution did not match the expected answer",
          },
        };
      }
      return gate;
    });
    const verification: Verification = {
      candidate_id: "00000000-0000-0000-0000-000000000004",
      overall: "rejected",
      gates,
      attempt_count: 1,
    };

    const decision = policy.decide(verification);

    expect(decision.refinementHint).toBe(
      "SymPy 검산 불일치: 기대답 1, 6, 엔진 결과 2, 3 — 계수를 다시 검산하라",
    );
    expect(decision.counterexample).toContain("이전 실패 후보(반복 금지)");
    expect(decision.counterexample).toContain("x**2 - 5*x + 6 = 0");
    expect(decision.counterexample).toContain("정답: 1, 6");
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

  it("aborts the signal passed to fn when it times out", async () => {
    let aborted = false;
    await expect(
      withTimeout(
        (signal) =>
          new Promise<number>((resolve) => {
            signal.addEventListener("abort", () => {
              aborted = true;
            });
            setTimeout(() => resolve(42), 50);
          }),
        { ms: 1, label: "slow" },
      ),
    ).rejects.toThrow(/slow timed out/);
    expect(aborted).toBe(true);
  });

  it("leaves the signal unaborted when fn resolves in time", async () => {
    let aborted = false;
    const result = await withTimeout(
      (signal) => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
        return Promise.resolve(7);
      },
      { ms: 1000, label: "fast" },
    );
    expect(result).toBe(7);
    expect(aborted).toBe(false);
  });
});
