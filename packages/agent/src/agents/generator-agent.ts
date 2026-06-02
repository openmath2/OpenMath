/** GeneratorAgent — D-5 GenerationSpecialist team. Produces GeneratedProblem candidate. */

import { randomUUID } from "node:crypto";

import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";

import type {
  GenerateRequest,
  GeneratedProblem,
  Intent,
  RagResult,
  Strategy,
} from "../schemas/index.js";
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
  modelId: string;
  promptId: string;
  prompts: PromptLoader;
}

const LlmGeneratedCandidateSchema = z.object({
  question_text: z
    .string()
    .min(1)
    .describe("SymPy-parseable x equation, transformed from the selected source problem"),
  expected_answer: z
    .string()
    .min(1)
    .describe("Comma-separated exact solutions using sqrt(...) when needed"),
  proposed_solution_trace: z
    .string()
    .min(1)
    .describe("Korean solution trace explaining the structural/conceptual transform"),
});

export function createGeneratorAgent(deps: GeneratorAgentDeps): GeneratorAgent {
  return {
    async generate(input) {
      const prompt = await deps.prompts.load(deps.promptId);
      const rendered = prompt.render({
        request: input.request,
        intent: input.intent,
        refs: input.refs,
        strategy: input.strategy === null ? "" : JSON.stringify(input.strategy, null, 2),
        refinementHint: input.refinementHint,
      });
      const { object } = await generateObject({
        model: deps.model,
        schema: LlmGeneratedCandidateSchema,
        mode: "json",
        temperature: prompt.metadata.temperature,
        prompt: rendered,
      });

      return {
        candidate_id: randomUUID(),
        mode: input.request.mode === "conceptual" ? "conceptual" : "structural",
        question_text: object.question_text,
        expected_answer: object.expected_answer,
        proposed_solution_trace: object.proposed_solution_trace,
        source_refs: input.refs.map((ref) => ref.item_id),
        inferred_intent: input.intent,
        generation_metadata: {
          model: deps.modelId,
          temperature: prompt.metadata.temperature,
          prompt_id: prompt.metadata.id,
          prompt_version: prompt.metadata.version,
          attempt: input.attempt,
          generated_at: new Date().toISOString(),
        },
      };
    },
  };
}
