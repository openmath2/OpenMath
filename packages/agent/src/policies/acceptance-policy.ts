/** Acceptance policy — composes Verification.gates into Verification.overall (I-V2 ~ I-V5). */

import type { GateResult, OverallVerdict } from "../schemas/index.js";

export interface AcceptancePolicy {
  decide(gates: GateResult[], attemptCount: number): OverallVerdict;
}

export function createAcceptancePolicy(): AcceptancePolicy {
  return {
    decide(gates, attemptCount) {
      if (attemptCount > 3) return "rejected";

      const byStep = new Map(gates.map((gate) => [gate.step, gate]));
      const sympy = byStep.get("sympy_verify");
      const objective = byStep.get("objective_map");
      const reSolve = byStep.get("re_solve");

      if (sympy?.status !== "passed") return "rejected";
      if (objective?.status !== "passed") return "rejected";
      if (reSolve?.status === "failed") return "warning";
      if (gates.some((gate) => gate.status === "failed")) return "rejected";

      return "verified";
    },
  };
}
