/** Step 6: Learning objective mapping. Deterministic match on achievement code + evaluation
 *  dimensions (D-5). LLM may suggest nuance, never decides (D-1). */

import type { LanguageModel } from "ai";
import { generateObject } from "ai";

import {
  ObjectiveMappingNuanceSchema,
  getGenerateRequestTopicCode,
  strategySupportsConceptual,
  type GateResult,
  type GenerateRequest,
  type GeneratedProblem,
  type Intent,
  type ObjectiveMappingNuance,
  type RagResult,
  type Strategy,
} from "../schemas/index.js";
import { withTimeout } from "../policies/timeout-policy.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export interface ObjectiveMappingDeps {
  llm?: LanguageModel;
  prompts?: PromptLoader;
  perStepTimeoutMs?: number;
}

export interface ObjectiveMappingInput {
  request: GenerateRequest;
  refs: RagResult[];
  candidate: GeneratedProblem;
  intent: Intent;
  strategy: Strategy | null;
}

export interface ObjectiveMappingOutput {
  data: ObjectiveMappingNuance | null;
  gate: GateResult;
}

export async function mapObjective(
  deps: ObjectiveMappingDeps,
  input: ObjectiveMappingInput,
): Promise<ObjectiveMappingOutput> {
  const started = Date.now();
  const failures = evaluateDeterministically(input);
  const nuance = await loadNuance(deps, input);
  return {
    data: nuance,
    gate: {
      step: "objective_map",
      status: failures.length === 0 ? "passed" : "failed",
      duration_ms: Date.now() - started,
      evidence: {
        refs: input.refs.length,
        mode: input.request.mode,
        source_problem_text: input.request.source_problem_text ?? null,
        strategy_code: input.strategy?.code ?? null,
        difficulty: input.request.difficulty,
        problem_type: input.request.problem_type,
        llm_nuance: nuance,
      },
      failure_detail:
        failures.length === 0
          ? undefined
          : {
              code: failures[0]?.code ?? "objective_map_failed",
              message: failures.map((failure) => failure.message).join("; "),
            },
    },
  };
}

function evaluateDeterministically(input: ObjectiveMappingInput): Array<{ code: string; message: string }> {
  const failures: Array<{ code: string; message: string }> = [];
  const { request, strategy, refs, candidate } = input;

  if (strategy === null) {
    failures.push({ code: "objective_unmapped", message: "No strategy available" });
  } else {
    if (strategy.code !== getGenerateRequestTopicCode(request)) {
      failures.push({
        code: "strategy_topic_mismatch",
        message: `Strategy ${strategy.code} does not match request topic ${getGenerateRequestTopicCode(request)}`,
      });
    }
    if (!strategy.difficulty_range.includes(request.difficulty)) {
      failures.push({
        code: "difficulty_unsupported",
        message: `Strategy ${strategy.code} does not support ${request.difficulty} difficulty`,
      });
    }
    if (!strategy.problem_types_supported.includes(request.problem_type)) {
      failures.push({
        code: "problem_type_unsupported",
        message: `Strategy ${strategy.code} does not support ${request.problem_type} problems`,
      });
    }
    if (request.mode === "conceptual" && !strategySupportsConceptual(strategy)) {
      failures.push({
        code: "conceptual_unsupported",
        message: `Strategy ${strategy.code} has no conceptual transforms`,
      });
    }
    if (request.mode !== "conceptual" && strategy.structural_transforms.length === 0) {
      failures.push({
        code: "structural_unsupported",
        message: `Strategy ${strategy.code} has no structural transforms`,
      });
    }
  }

  if (refs.length === 0) {
    failures.push({ code: "no_refs", message: "No reference problems available" });
  }

  const sourceText = request.source_problem_text ?? refs[0]?.problem.question_text;
  if (sourceText !== undefined && sameMathText(candidate.question_text, sourceText)) {
    failures.push({
      code: "not_transformed",
      message: "Generated candidate is identical to the source problem",
    });
  }

  return failures;
}

async function loadNuance(
  deps: ObjectiveMappingDeps,
  input: ObjectiveMappingInput,
): Promise<ObjectiveMappingNuance | null> {
  const llm = deps.llm;
  const prompts = deps.prompts;
  if (llm === undefined || prompts === undefined) return null;
  try {
    return await withTimeout(async () => {
      const prompt = await prompts.load("objective-mapper");
      const rendered = prompt.render({
        candidate: input.candidate,
        intent: input.intent,
        strategy: input.strategy === null ? "" : JSON.stringify(input.strategy, null, 2),
      });
      const { object } = await generateObject({
        model: llm,
        schema: ObjectiveMappingNuanceSchema,
        mode: "json",
        temperature: prompt.metadata.temperature,
        prompt: rendered,
      });
      return object;
    }, { ms: deps.perStepTimeoutMs ?? 30_000, label: "objective_map_llm" });
  } catch {
    return null;
  }
}

function sameMathText(left: string, right: string): boolean {
  return normalizeMathText(left) === normalizeMathText(right);
}

function normalizeMathText(value: string): string {
  return value
    .replace(/²/g, "**2")
    .replace(/\s+/g, "")
    .toLowerCase();
}
