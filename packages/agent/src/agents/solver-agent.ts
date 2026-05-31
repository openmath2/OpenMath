/** SolverAgent — D-5 ReSolveSpecialist. Independent re-solver with different prompt/model.
 *  Produces a solution trace; never the final judge (D-1). */

import { generateObject } from "ai";
import type { LanguageModel } from "ai";

import type { GeneratedProblem, SolveAttempt } from "../schemas/index.js";
import { SolveAttemptSchema } from "../schemas/index.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export interface SolverAgent {
  solve(candidate: GeneratedProblem): Promise<SolveAttempt>;
}

export interface SolverAgentDeps {
  model: LanguageModel;
  prompts: PromptLoader;
  promptId?: string;
}

export function createSolverAgent(deps: SolverAgentDeps): SolverAgent {
  const promptId = deps.promptId ?? "independent-solver";

  return {
    async solve(candidate) {
      const prompt = await deps.prompts.load(promptId);
      const result = await generateObject({
        model: deps.model,
        schema: SolveAttemptSchema,
        temperature: prompt.metadata.temperature,
        maxTokens: prompt.metadata.max_tokens,
        prompt: prompt.render({ candidate }),
      });

      return result.object;
    },
  };
}
