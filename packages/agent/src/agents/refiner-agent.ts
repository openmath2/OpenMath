/** RefinerAgent — D-5 GenerationSpecialist team. Re-runs GeneratorAgent with critique hints. */

import type { LanguageModel } from "ai";

import type { GenerateRequest, GeneratedProblem, Intent, RagResult, Strategy } from "../schemas/index.js";
import type { GeneratorAgent } from "./generator-agent.js";

export interface RefineInput {
  prior: GeneratedProblem;
  request: GenerateRequest;
  intent: Intent;
  refs: RagResult[];
  strategy: Strategy | null;
  attempt: number;
  hints: string[];
}

export interface RefinerAgent {
  refine(input: RefineInput): Promise<GeneratedProblem>;
}

export interface RefinerAgentDeps {
  model: LanguageModel;
  modelId: string;
  promptId: string;
  generator: GeneratorAgent;
}

export function createRefinerAgent(deps: RefinerAgentDeps): RefinerAgent {
  return {
    async refine(input) {
      const refinementHint = [
        "Prior candidate:",
        input.prior.question_text,
        "Critique hints:",
        ...input.hints.map((hint) => `- ${hint}`),
      ].join("\n");

      return deps.generator.generate({
        request: input.request,
        intent: input.intent,
        refs: input.refs,
        strategy: input.strategy,
        attempt: input.attempt,
        refinementHint,
      });
    },
  };
}
