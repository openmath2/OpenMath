/** Acceptance policy — composes Verification.gates into Verification.overall (I-V2 ~ I-V5). */

import type { GateResult, OverallVerdict } from "../schemas/index.js";

export interface AcceptancePolicy {
  decide(gates: GateResult[], attemptCount: number): OverallVerdict;
}

export interface AcceptancePolicyOptions {
  maxAttempts?: number;
}

export function createAcceptancePolicy(opts?: AcceptancePolicyOptions): AcceptancePolicy {
  const maxAttempts = opts?.maxAttempts ?? 3;
  return {
    decide(gates, attemptCount) {
      if (attemptCount > maxAttempts) return "rejected";

      const byStep = new Map(gates.map((gate) => [gate.step, gate]));
      const sympy = byStep.get("sympy_verify");
      const objective = byStep.get("objective_map");
      const reSolve = byStep.get("re_solve");

      if (sympy?.status === "failed") return "rejected";
      if (objective?.status === "failed") return "rejected";
      if (gates.some((gate) => gate.status === "failed" && gate.step !== "re_solve")) {
        return "rejected";
      }
      if (reSolve?.status === "failed") {
        return attemptCount >= maxAttempts ? "rejected" : "warning";
      }
      if (sympy?.status === "unverified") return "warning";
      if (gates.some((gate) => gate.status === "unverified")) return "warning";
      if (sympy?.status !== "passed") return "rejected";
      if (objective?.status !== "passed") return "rejected";

      return "verified";
    },
  };
}
