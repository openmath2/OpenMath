/** GeneratorAgent — D-5 GenerationSpecialist team. Produces GeneratedProblem candidate. */

import { randomUUID } from "node:crypto";

import { generateObject, NoObjectGeneratedError, type LanguageModel } from "ai";
import { z } from "zod";

import type {
  GenerateRequest,
  GeneratedProblem,
  Intent,
  RagResult,
  Strategy,
} from "../schemas/index.js";
import { generationKindForTopic, getGenerateRequestTopicCode } from "../schemas/index.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export interface GeneratorAgentInput {
  request: GenerateRequest;
  intent: Intent;
  refs: RagResult[];
  strategy: Strategy | null;
  attempt: number;
  refinementHint?: string;
  counterexample?: string;
  signal?: AbortSignal;
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

export const LlmGeneratedCandidateSchema = z.object({
  question_text: z
    .string()
    .min(1)
    .describe("Generated Korean middle-school math problem matching the requested generation kind"),
  expected_answer: z
    .string()
    .min(1)
    .describe("Exact answer in a compact plain-text math format"),
  techniques_used: z
    .array(z.string())
    .default([])
    .describe("Technique ids used in the solution, selected from the strategy vocabulary"),
  proposed_solution_trace: z
    .string()
    .min(1)
    .describe("Korean solution trace explaining the structural/conceptual transform"),
  verification_expression: z
    .string()
    .min(1)
    .optional()
    .describe(
      "SymPy-parseable expression that deterministically reaches expected_answer. Numeric answers: an arithmetic expression whose value equals it, e.g. factorial(3)*factorial(3)*factorial(4). Algebraic answers (expand/simplify): the un-expanded source expression from the problem setup (NOT the answer copied) that SymPy-simplifies to expected_answer, e.g. x**3 + 5*x*(x+1) - (x+4)*(x-1)*(x+2). Use explicit * for multiplication. Omit only when the answer is not a single numeric/algebraic value",
    ),
});

export type LlmGeneratedCandidate = z.infer<typeof LlmGeneratedCandidateSchema>;

/** LLM raw output + 호출 컨텍스트 → 도메인 GeneratedProblem. Generator와 Refiner가 공유. */
export function assembleGeneratedProblem(input: {
  readonly request: GenerateRequest;
  readonly intent: Intent;
  readonly refs: RagResult[];
  readonly attempt: number;
  readonly object: LlmGeneratedCandidate;
  readonly modelId: string;
  readonly temperature: number;
  readonly promptId: string;
  readonly promptVersion: string;
}): GeneratedProblem {
  const generationKind =
    input.request.source_origin === "attached" && input.request.generation_kind !== undefined
      ? input.request.generation_kind
      : generationKindForTopic(getGenerateRequestTopicCode(input.request));
  return {
    candidate_id: randomUUID(),
    mode: input.request.mode === "conceptual" ? "conceptual" : "structural",
    generation_kind: generationKind,
    question_text: input.object.question_text,
    expected_answer: input.object.expected_answer,
    techniques_used: input.object.techniques_used ?? [],
    proposed_solution_trace: input.object.proposed_solution_trace,
    ...(input.object.verification_expression === undefined
      ? {}
      : { verification_expression: input.object.verification_expression }),
    source_refs: input.refs.map((ref) => ref.item_id),
    inferred_intent: input.intent,
    generation_metadata: {
      model: input.modelId,
      temperature: input.temperature,
      prompt_id: input.promptId,
      prompt_version: input.promptVersion,
      attempt: input.attempt,
      generated_at: new Date().toISOString(),
    },
  };
}

export function temperatureForGeneratorAttempt(
  attempt: number,
  firstAttemptTemperature = 0.35,
): number {
  if (attempt <= 1) return firstAttemptTemperature;
  if (attempt === 2) return 0.6;
  return 0.85;
}

export function createGeneratorAgent(deps: GeneratorAgentDeps): GeneratorAgent {
  return {
    async generate(input) {
      const prompt = await deps.prompts.load(deps.promptId);
      const generationKind =
        input.request.source_origin === "attached" && input.request.generation_kind !== undefined
          ? input.request.generation_kind
          : generationKindForTopic(getGenerateRequestTopicCode(input.request));
      const temperature = temperatureForGeneratorAttempt(
        input.attempt,
        prompt.metadata.temperature,
      );
      const basePromptVars = {
        request: input.request,
        generationKind,
        attached: input.request.source_origin === "attached",
        intent: input.intent,
        refs: input.refs,
        strategy: input.strategy === null ? "" : JSON.stringify(input.strategy, null, 2),
        refinementHint: input.refinementHint,
        counterexample: input.counterexample,
      };
      const object = await generateCandidateObject({
        model: deps.model,
        prompt: prompt.render(basePromptVars),
        temperature,
        signal: input.signal,
        retryPromptForSchemaError(schemaError) {
          return prompt.render({ ...basePromptVars, schemaError });
        },
      });

      return assembleGeneratedProblem({
        request: input.request,
        intent: input.intent,
        refs: input.refs,
        attempt: input.attempt,
        object,
        modelId: deps.modelId,
        temperature,
        promptId: prompt.metadata.id,
        promptVersion: prompt.metadata.version,
      });
    },
  };
}

export interface GenerateCandidateObjectInput {
  model: LanguageModel;
  prompt: string;
  temperature: number;
  signal?: AbortSignal;
  retryPromptForSchemaError(schemaError: string): string;
}

/** generateObject + schema-repair 1회 재시도. Generator와 Refiner가 공유. */
export async function generateCandidateObject(
  input: GenerateCandidateObjectInput,
): Promise<LlmGeneratedCandidate> {
  try {
    const { object } = await generateObject({
      model: input.model,
      schema: LlmGeneratedCandidateSchema,
      mode: "json",
      temperature: input.temperature,
      prompt: input.prompt,
      abortSignal: input.signal,
    });
    return object;
  } catch (error) {
    if (!isSchemaGenerationFailure(error)) throw error;
    const { object } = await generateObject({
      model: input.model,
      schema: LlmGeneratedCandidateSchema,
      mode: "json",
      temperature: input.temperature,
      prompt: input.retryPromptForSchemaError(schemaFailureMessage(error)),
      abortSignal: input.signal,
    });
    return object;
  }
}

function isSchemaGenerationFailure(error: unknown): boolean {
  if (NoObjectGeneratedError.isInstance(error)) return true;
  if (error instanceof z.ZodError) return true;
  if (isTypeValidationError(error)) return true;
  const cause = causeOf(error);
  return cause === undefined ? false : isSchemaGenerationFailure(cause);
}

function schemaFailureMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (hasMessage(error) && typeof error.message === "string") return error.message;
  return String(error);
}

function isTypeValidationError(error: unknown): boolean {
  return hasName(error) && error.name === "TypeValidationError";
}

function causeOf(error: unknown): unknown | undefined {
  return hasCause(error) ? error.cause : undefined;
}

function hasCause(value: unknown): value is { readonly cause?: unknown } {
  return typeof value === "object" && value !== null && "cause" in value;
}

function hasName(value: unknown): value is { readonly name?: unknown } {
  return typeof value === "object" && value !== null && "name" in value;
}

function hasMessage(value: unknown): value is { readonly message?: unknown } {
  return typeof value === "object" && value !== null && "message" in value;
}
