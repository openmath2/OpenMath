/** GeneratorAgent — D-5 GenerationSpecialist team. Produces GeneratedProblem candidate. */

import { randomUUID } from "node:crypto";

import { generateObject } from "ai";
import type { LanguageModel } from "ai";

import type {
  GenerateRequest,
  GeneratedProblem,
  Intent,
  RagResult,
  Strategy,
} from "../schemas/index.js";
import { GeneratedProblemSchema } from "../schemas/index.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export interface GeneratorAgentInput {
  request: GenerateRequest;
  intent: Intent;
  refs: RagResult[];
  strategy: Strategy | null;
  attempt: number;
  refinementHint?: string;
}

export interface GeneratorAgent {
  generate(input: GeneratorAgentInput): Promise<GeneratedProblem>;
}

export interface GeneratorAgentDeps {
  model: LanguageModel;
  prompts: PromptLoader;
  promptId?: string;
}

export function createGeneratorAgent(deps: GeneratorAgentDeps): GeneratorAgent {
  const promptId = deps.promptId ?? "problem-generator";

  return {
    async generate(input) {
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
        candidate_id: result.object.candidate_id || randomUUID(),
        mode: result.object.mode === "conceptual" ? "conceptual" : "structural",
        source_refs: result.object.source_refs.length
          ? result.object.source_refs
          : input.refs.map((ref) => ref.item_id),
        inferred_intent: {
          ...result.object.inferred_intent,
          objective_code: input.intent.objective_code,
        },
        generation_metadata: {
          ...result.object.generation_metadata,
          model: prompt.metadata.model,
          temperature: prompt.metadata.temperature,
          prompt_id: prompt.metadata.id,
          prompt_version: prompt.metadata.version,
          attempt: input.attempt,
          generated_at: new Date().toISOString(),
        },
      });
    },
  };
}
