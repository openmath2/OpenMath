/** ConstraintCriticAgent — D-5 GenerationSpecialist team. Checks non-mathematical constraints
 *  (Korean middle-school level, problem-type format, wording clarity). Never judges correctness. */

import type { LanguageModel } from "ai";

import type { GeneratedProblem, Intent, Strategy } from "../schemas/index.js";

export interface CritiqueInput {
  candidate: GeneratedProblem;
  intent: Intent;
  strategy: Strategy | null;
}

export interface Critique {
  passes: boolean;
  hints: string[];
}

export interface ConstraintCriticAgent {
  critique(input: CritiqueInput): Promise<Critique>;
}

export interface ConstraintCriticAgentDeps {
  model: LanguageModel;
  promptId: string;
}

export function createConstraintCriticAgent(
  _deps: ConstraintCriticAgentDeps,
): ConstraintCriticAgent {
  throw new Error("createConstraintCriticAgent: not implemented yet");
}
