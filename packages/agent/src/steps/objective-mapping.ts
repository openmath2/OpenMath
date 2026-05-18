/** Step 6: Learning objective mapping. Deterministic match on achievement code + evaluation
 *  dimensions (D-5). LLM may suggest nuance, never decides (D-1). */

import type { LanguageModel } from "ai";

import type {
  GateResult,
  GeneratedProblem,
  Intent,
  Strategy,
} from "../schemas/index.js";

export interface ObjectiveMappingDeps {
  llm?: LanguageModel;
}

export interface ObjectiveMappingInput {
  candidate: GeneratedProblem;
  intent: Intent;
  strategy: Strategy | null;
}

export interface ObjectiveMappingOutput {
  gate: GateResult;
}

export async function mapObjective(
  _deps: ObjectiveMappingDeps,
  _input: ObjectiveMappingInput,
): Promise<ObjectiveMappingOutput> {
  throw new Error("mapObjective: not implemented yet");
}
