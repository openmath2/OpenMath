/** ConstraintCriticAgent — D-5 GenerationSpecialist team. Checks non-mathematical constraints
 *  (Korean middle-school level, problem-type format, wording clarity). Never judges correctness. */

import { generateObject } from "ai";
import type { LanguageModel } from "ai";

import type { Critique, GeneratedProblem, Intent, Strategy } from "../schemas/index.js";
import { CritiqueSchema } from "../schemas/index.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export interface CritiqueInput {
  candidate: GeneratedProblem;
  intent: Intent;
  strategy: Strategy | null;
}

export interface ConstraintCriticAgent {
  critique(input: CritiqueInput): Promise<Critique>;
}

export interface ConstraintCriticAgentDeps {
  model: LanguageModel;
  prompts: PromptLoader;
  promptId?: string;
}

export function createConstraintCriticAgent(
  deps: ConstraintCriticAgentDeps,
): ConstraintCriticAgent {
  const promptId = deps.promptId ?? "constraint-critic";

  return {
    async critique(input) {
      const localHints = localCritique(input);
      if (localHints.length > 0) {
        return { passes: false, hints: localHints };
      }

      const prompt = await deps.prompts.load(promptId);
      const result = await generateObject({
        model: deps.model,
        schema: CritiqueSchema,
        temperature: prompt.metadata.temperature,
        maxTokens: prompt.metadata.max_tokens,
        prompt: prompt.render({ ...input }),
      });

      return result.object;
    },
  };
}

function localCritique(input: CritiqueInput): string[] {
  const hints: string[] = [];
  const text = [
    input.candidate.question_text,
    input.candidate.expected_answer,
    input.candidate.proposed_solution_trace,
  ].join("\n");

  if (count(text, "$") % 2 !== 0) {
    hints.push("LaTeX inline math delimiter '$' count is odd.");
  }
  if (count(text, "{") !== count(text, "}")) {
    hints.push("LaTeX brace count is unbalanced.");
  }
  if (
    input.intent.surface_constraints.problem_type === "objective" &&
    (input.candidate.expected_choices?.length ?? 0) < 2
  ) {
    hints.push("Objective problems need at least two answer choices.");
  }

  return hints;
}

function count(value: string, needle: string): number {
  return value.split(needle).length - 1;
}
