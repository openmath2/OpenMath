/** Acceptance policy — composes Verification.gates into Verification.overall (I-V2 ~ I-V5). */

import type { GateResult, OverallVerdict } from "../schemas/index.js";

export interface AcceptancePolicy {
  decide(gates: GateResult[], attemptCount: number): OverallVerdict;
}

export function createAcceptancePolicy(): AcceptancePolicy {
  throw new Error("createAcceptancePolicy: not implemented yet");
}
