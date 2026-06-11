/** Step 2: Intent extraction. Single LLM agent (D-5). Output validated by IntentSchema (I-I1, I-I2). */

import type { LanguageModel } from "ai";
import { generateObject } from "ai";

import {
  IntentSchema,
  assertIntentInvariants,
  getGenerateRequestTopicCode,
  type GateResult,
  type GenerateRequest,
  type Intent,
  type RagResult,
  type Strategy,
} from "../schemas/index.js";
import { withTimeout } from "../policies/timeout-policy.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export interface IntentExtractionDeps {
  model: LanguageModel;
  prompts: PromptLoader;
  perStepTimeoutMs?: number;
}

export interface IntentExtractionInput {
  request: GenerateRequest;
  refs: RagResult[];
  strategy: Strategy | null;
}

export interface IntentExtractionOutput {
  data: Intent;
  gate: GateResult;
}

export async function extractIntent(
  deps: IntentExtractionDeps,
  input: IntentExtractionInput,
): Promise<IntentExtractionOutput> {
  const started = Date.now();
  try {
    const intent = await withTimeout(async (signal) => {
      const prompt = await deps.prompts.load("intent-extraction");
      const rendered = prompt.render({
        request: input.request,
        refs: input.refs,
        strategy: input.strategy === null ? "" : JSON.stringify(input.strategy, null, 2),
      });
      const { object } = await generateObject({
        model: deps.model,
        schema: IntentSchema,
        mode: "json",
        temperature: prompt.metadata.temperature,
        prompt: rendered,
        abortSignal: signal,
      });
      assertIntentInvariants(object);
      return object;
    }, { ms: deps.perStepTimeoutMs ?? 30_000, label: "intent" });

    return {
      data: intent,
      gate: {
        step: "intent",
        status: "passed",
        duration_ms: Date.now() - started,
        evidence: {
          objective_code: intent.objective_code,
          dimensions: intent.evaluation_dimensions.length,
        },
      },
    };
  } catch (err) {
    const fallback = buildSeedIntent(input.request, input.strategy, input.refs);
    assertIntentInvariants(fallback);
    const dimensionsSource = input.strategy === null ? "guessed" : "strategy";
    return {
      data: fallback,
      gate: {
        step: "intent",
        status: "passed",
        duration_ms: Date.now() - started,
        evidence: {
          objective_code: fallback.objective_code,
          dimensions: fallback.evaluation_dimensions.length,
          fallback: true,
          dimensions_source: dimensionsSource,
          llm_error: err instanceof Error ? err.message : String(err),
        },
      },
    };
  }
}

function buildSeedIntent(
  request: GenerateRequest,
  strategy: Strategy | null,
  refs: RagResult[],
): Intent {
  // refs 가 없어도(첨부 source-only) 동작한다 — strategy·request 의 토픽 정보로 시드 의도를 만든다.
  // corpus 플로우는 refs 가 항상 있으므로 first 기반 동작이 그대로 유지된다.
  const first = refs[0];
  const topicName =
    first?.problem.topic_name ?? request.topic_name ?? getGenerateRequestTopicCode(request);
  const objectiveCode =
    strategy?.code ?? first?.problem.achievement_standard ?? getGenerateRequestTopicCode(request);
  return {
    objective_code: objectiveCode,
    objective_description: strategy?.title ?? topicName,
    evaluation_dimensions:
      strategy?.evaluation_dimensions ??
      buildGuessedEvaluationDimensions(request, topicName),
    required_techniques: strategy?.techniques.required_at_least_one_of ?? [],
    forbidden_techniques: strategy?.techniques.forbidden ?? [],
    surface_constraints: {
      difficulty: request.difficulty,
      problem_type: request.problem_type,
    },
  };
}

function buildGuessedEvaluationDimensions(
  request: GenerateRequest,
  fallbackDescription: string,
): Intent["evaluation_dimensions"] {
  const descriptions = request.dims.length > 0 ? request.dims : [fallbackDescription];
  return descriptions.map((description, index) => ({
    id: String.fromCharCode(65 + index),
    description,
    must_preserve: index === 0,
  }));
}
