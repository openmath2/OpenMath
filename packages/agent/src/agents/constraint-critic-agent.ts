/** ConstraintCriticAgent — D-5 GenerationSpecialist team. Checks non-mathematical constraints
 *  (Korean middle-school level, problem-type format, wording clarity). Never judges correctness. */

import type { LanguageModel } from "ai";
import { generateObject } from "ai";

import {
  CritiqueSchema,
  type Critique,
  type GeneratedProblem,
  type Intent,
  type Strategy,
} from "../schemas/index.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export interface CritiqueInput {
  candidate: GeneratedProblem;
  intent: Intent;
  strategy: Strategy | null;
}

export type { Critique } from "../schemas/index.js";

export interface ConstraintCriticAgent {
  critique(input: CritiqueInput): Promise<Critique>;
}

export interface ConstraintCriticAgentDeps {
  model: LanguageModel;
  modelId: string;
  promptId: string;
  prompts: PromptLoader;
}

export function createConstraintCriticAgent(
  deps: ConstraintCriticAgentDeps,
): ConstraintCriticAgent {
  return {
    async critique(input) {
      const prompt = await deps.prompts.load(deps.promptId);
      const rendered = prompt.render({
        candidate: input.candidate,
        intent: input.intent,
        strategy: input.strategy === null ? "" : JSON.stringify(input.strategy, null, 2),
      });
      const { object } = await generateObject({
        model: deps.model,
        schema: CritiqueSchema,
        mode: "json",
        temperature: prompt.metadata.temperature,
        prompt: rendered,
      });
      return object;
    },
  };
}
