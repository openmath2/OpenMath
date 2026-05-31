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
  input: ObjectiveMappingInput,
): Promise<ObjectiveMappingOutput> {
  const started = Date.now();
  const expectedCode = input.intent.objective_code;
  const actualCode = input.candidate.inferred_intent.objective_code;
  const preserved = input.intent.evaluation_dimensions
    .filter((dimension) => dimension.must_preserve)
    .map((dimension) => dimension.id);
  const candidateDimensions = new Set(
    input.candidate.inferred_intent.evaluation_dimensions
      .filter((dimension) => dimension.must_preserve)
      .map((dimension) => dimension.id),
  );
  const missing = preserved.filter((id) => !candidateDimensions.has(id));
  const passed = expectedCode === actualCode && missing.length === 0;

  return {
    gate: {
      step: "objective_map",
      status: passed ? "passed" : "failed",
      duration_ms: Date.now() - started,
      evidence: {
        expected_code: expectedCode,
        actual_code: actualCode,
        preserved_dimensions: preserved,
        missing_dimensions: missing,
        strategy_code: input.strategy?.code ?? null,
      },
      ...(passed
        ? {}
        : {
            failure_detail: {
              code: "objective_mismatch",
              message: "Generated problem drifted from the requested objective.",
            },
          }),
    },
  };
}
