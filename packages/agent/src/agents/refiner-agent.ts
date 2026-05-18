/** RefinerAgent — D-5 GenerationSpecialist team. Re-runs GeneratorAgent with critique hints. */

import type { LanguageModel } from "ai";

import type { GeneratedProblem, Intent } from "../schemas/index.js";

export interface RefineInput {
  prior: GeneratedProblem;
  intent: Intent;
  hints: string[];
}

export interface RefinerAgent {
  refine(input: RefineInput): Promise<GeneratedProblem>;
}

export interface RefinerAgentDeps {
  model: LanguageModel;
  promptId: string;
}

export function createRefinerAgent(_deps: RefinerAgentDeps): RefinerAgent {
  throw new Error("createRefinerAgent: not implemented yet");
}
