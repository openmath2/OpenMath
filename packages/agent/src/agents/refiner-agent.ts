/** RefinerAgent — D-5 GenerationSpecialist team. Re-runs GeneratorAgent with critique hints. */

import { generateObject } from "ai";
import type { LanguageModel } from "ai";

import type { GeneratedProblem, Intent } from "../schemas/index.js";
import { GeneratedProblemSchema } from "../schemas/index.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

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
  prompts: PromptLoader;
  promptId?: string;
}

export function createRefinerAgent(deps: RefinerAgentDeps): RefinerAgent {
  const promptId = deps.promptId ?? "refiner";

  return {
    async refine(input) {
      const prompt = await deps.prompts.load(promptId);
      const result = await generateObject({
        model: deps.model,
        schema: GeneratedProblemSchema,
        temperature: prompt.metadata.temperature,
        maxTokens: prompt.metadata.max_tokens,
        prompt: prompt.render({ ...input }),
      });

      return GeneratedProblemSchema.parse({
        ...result.object,
        candidate_id: input.prior.candidate_id,
        mode: input.prior.mode,
        source_refs: input.prior.source_refs,
        inferred_intent: input.intent,
        generation_metadata: {
          ...input.prior.generation_metadata,
          ...result.object.generation_metadata,
          prompt_id: prompt.metadata.id,
          prompt_version: prompt.metadata.version,
          temperature: prompt.metadata.temperature,
          attempt: input.prior.generation_metadata.attempt + 1,
          generated_at: new Date().toISOString(),
          refined_by: [
            ...(input.prior.generation_metadata.refined_by ?? []),
            "refiner",
          ],
        },
      });
    },
  };
}
