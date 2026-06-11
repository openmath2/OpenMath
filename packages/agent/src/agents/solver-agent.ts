/** SolverAgent — D-5 ReSolveSpecialist. Independent re-solver with different prompt/model.
 *  Produces a solution trace; never the final judge (D-1). */

import type { LanguageModel } from "ai";
import { generateObject } from "ai";

import { SolveAttemptSchema, type GeneratedProblem, type SolveAttempt } from "../schemas/index.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export type { SolveAttempt } from "../schemas/index.js";

export interface SolverAgent {
  solve(candidate: GeneratedProblem, signal?: AbortSignal): Promise<SolveAttempt>;
}

export interface SolverAgentDeps {
  model: LanguageModel;
  modelId: string;
  promptId: string;
  prompts: PromptLoader;
}

export function createSolverAgent(deps: SolverAgentDeps): SolverAgent {
  return {
    async solve(candidate, signal) {
      const prompt = await deps.prompts.load(deps.promptId);
      const rendered = prompt.render({ candidate });
      const { object } = await generateObject({
        model: deps.model,
        schema: SolveAttemptSchema,
        mode: "json",
        temperature: prompt.metadata.temperature,
        prompt: rendered,
        abortSignal: signal,
      });
      return object;
    },
  };
}
