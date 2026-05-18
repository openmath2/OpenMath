/** SolverAgent — D-5 ReSolveSpecialist. Independent re-solver with different prompt/model.
 *  Produces a solution trace; never the final judge (D-1). */

import type { LanguageModel } from "ai";

import type { GeneratedProblem } from "../schemas/index.js";

export interface SolveAttempt {
  derived_answer: string;
  trace: string;
  confidence: "high" | "medium" | "low";
}

export interface SolverAgent {
  solve(candidate: GeneratedProblem): Promise<SolveAttempt>;
}

export interface SolverAgentDeps {
  model: LanguageModel;
  promptId: string;
}

export function createSolverAgent(_deps: SolverAgentDeps): SolverAgent {
  throw new Error("createSolverAgent: not implemented yet");
}
