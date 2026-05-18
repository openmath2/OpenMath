/** Step 4: SymPy arithmetic verification. Deterministic (D-1, D-5). math-engine HTTP call. */

import type { GateResult, GeneratedProblem } from "../schemas/index.js";
import type { MathEngineClient } from "../tools/math-engine-client.js";

export interface SympyVerificationDeps {
  mathEngine: MathEngineClient;
}

export interface SympyVerificationInput {
  candidate: GeneratedProblem;
}

export interface SympyVerificationOutput {
  gate: GateResult;
}

export async function verifyWithSympy(
  _deps: SympyVerificationDeps,
  _input: SympyVerificationInput,
): Promise<SympyVerificationOutput> {
  throw new Error("verifyWithSympy: not implemented yet");
}
