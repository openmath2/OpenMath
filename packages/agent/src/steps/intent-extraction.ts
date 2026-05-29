/** Step 2: Intent extraction. Single LLM agent (D-5). Output validated by IntentSchema (I-I1, I-I2). */

import type { LanguageModel } from "ai";

import type {
  GenerateRequest,
  Intent,
  RagResult,
  Strategy,
} from "../schemas/index.js";
import { assertIntentInvariants } from "../schemas/index.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export interface IntentExtractionDeps {
  model?: LanguageModel;
  prompts?: PromptLoader;
}

export interface IntentExtractionInput {
  request: GenerateRequest;
  refs: RagResult[];
  strategy: Strategy | null;
}

export interface IntentExtractionOutput {
  intent: Intent;
}

export async function extractIntent(
  _deps: IntentExtractionDeps,
  input: IntentExtractionInput,
): Promise<IntentExtractionOutput> {
  const primaryRef = input.refs[0];
  const primaryProblem = primaryRef?.problem;
  const objectiveCode = firstValidObjectiveCode([
    input.request.topic_code,
    input.request.topic,
    primaryProblem?.topic_code,
    input.strategy?.code,
  ]);
  const objectiveDescription =
    primaryProblem?.achievement_standard ??
    input.strategy?.title ??
    input.request.topic_name ??
    input.request.topic ??
    "선택한 단원의 핵심 개념을 평가한다.";
  const dimensionDescription =
    primaryProblem === undefined
      ? objectiveDescription
      : [
          primaryProblem.topic_name,
          primaryProblem.question_text,
          primaryProblem.answer_text,
        ]
          .filter(Boolean)
          .join(" / ");

  const intent: Intent = {
    objective_code: objectiveCode,
    objective_description: objectiveDescription,
    evaluation_dimensions:
      input.strategy?.evaluation_dimensions.length
        ? input.strategy.evaluation_dimensions
        : [
            {
              id: "A",
              description: dimensionDescription,
              must_preserve: true,
            },
          ],
    required_techniques:
      input.strategy?.techniques.required_at_least_one_of.length
        ? input.strategy.techniques.required_at_least_one_of
        : [primaryProblem?.topic_name ?? input.request.topic_name ?? "core_concept"],
    forbidden_techniques: input.strategy?.techniques.forbidden ?? [],
    surface_constraints: {
      difficulty: input.request.difficulty,
      problem_type: input.request.problem_type,
      expected_choice_count:
        input.request.problem_type === "objective" ? 5 : undefined,
    },
  };

  assertIntentInvariants(intent);
  return { intent };
}

function firstValidObjectiveCode(candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && isObjectiveCode(candidate)) {
      return candidate;
    }
  }

  return "9수00-00";
}

function isObjectiveCode(value: string): boolean {
  return /^(9수|10공수)\d{2}-\d{2}$/.test(value);
}
