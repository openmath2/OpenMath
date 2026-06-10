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
  signal?: AbortSignal;
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
      try {
        const { object } = await generateObject({
          model: deps.model,
          schema: CritiqueSchema,
          mode: "json",
          temperature: prompt.metadata.temperature,
          prompt: rendered,
          abortSignal: input.signal,
        });
        return object;
      } catch (error) {
        const text = modelTextFromError(error);
        if (text !== null) {
          return parseCritiqueJson(text);
        }
        throw error;
      }
    },
  };
}

export function parseCritiqueJson(text: string): Critique {
  return CritiqueSchema.parse(JSON.parse(escapeRawBackslashes(text)));
}

function escapeRawBackslashes(text: string): string {
  return text.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

function modelTextFromError(error: unknown): string | null {
  if (!hasTextProperty(error)) return null;
  return typeof error.text === "string" ? error.text : null;
}

function hasTextProperty(value: unknown): value is { readonly text?: unknown } {
  return typeof value === "object" && value !== null && "text" in value;
}
