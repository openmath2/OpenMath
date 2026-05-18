/** Step 3: Problem generation. D-5 GenerationSpecialist team — Generator + ConstraintCritic + Refiner.
 *  This is the only step with internal multi-agent collaboration. */

import type {
  ConstraintCriticAgent,
  GeneratorAgent,
  RefinerAgent,
} from "../agents/index.js";
import type {
  GenerateRequest,
  GeneratedProblem,
  Intent,
  RagResult,
  Strategy,
} from "../schemas/index.js";

export interface ProblemGenerationDeps {
  generator: GeneratorAgent;
  critic: ConstraintCriticAgent;
  refiner: RefinerAgent;
  maxCriticRounds?: number;
}

export interface ProblemGenerationInput {
  request: GenerateRequest;
  intent: Intent;
  refs: RagResult[];
  strategy: Strategy | null;
  attempt: number;
}

export interface ProblemGenerationOutput {
  candidate: GeneratedProblem;
  refined_by: string[];
}

export async function generateProblem(
  _deps: ProblemGenerationDeps,
  _input: ProblemGenerationInput,
): Promise<ProblemGenerationOutput> {
  throw new Error("generateProblem: not implemented yet");
}
