/** Verification workflow — the deterministic Orchestrator (D-5 outer skeleton).
 *  Owns the user-visible 6-step progress. Streams ProgressEvent via async generator. */

import { randomUUID } from "node:crypto";

import type {
  GateResult,
  GenerateRequest,
  GeneratedProblem,
  Intent,
  ProgressEvent,
  RagResult,
  StepName,
  StepStatus,
  Strategy,
  Verification,
} from "../schemas/index.js";
import {
  assertVerificationInvariants,
  getGenerateRequestTopicCode,
  strategySupportsConceptual,
} from "../schemas/index.js";
import type {
  ConstraintCriticAgent,
  GeneratorAgent,
  RefinerAgent,
  SolverAgent,
} from "../agents/index.js";
import type { MathEngineClient } from "../tools/math-engine-client.js";
import type { PromptLoader } from "../tools/prompt-loader.js";
import type { RagClient } from "../tools/rag-client.js";
import type { StrategyLoader } from "../tools/schema-loader.js";
import type { LanguageModel } from "ai";
import { createAcceptancePolicy } from "../policies/acceptance-policy.js";
import { ragSearch } from "../steps/rag-search.js";
import { verifyWithSympy } from "../steps/sympy-verification.js";

export interface VerificationWorkflowDeps {
  rag: RagClient;
  mathEngine: MathEngineClient;
  prompts: PromptLoader;
  strategies: StrategyLoader;

  intentModel?: LanguageModel;
  generator?: GeneratorAgent;
  critic?: ConstraintCriticAgent;
  refiner?: RefinerAgent;
  solver?: SolverAgent;
  objectiveLlm?: LanguageModel;
}

export interface RunOptions {
  maxRetries?: number;
  perStepTimeoutMs?: number;
}

export type WorkflowYield = ProgressEvent;

export type WorkflowReturn = {
  verifications: Verification[];
};

export async function* runVerificationWorkflow(
  deps: VerificationWorkflowDeps,
  request: GenerateRequest,
  _options?: RunOptions,
): AsyncGenerator<WorkflowYield, WorkflowReturn, void> {
  const timestamp = () => new Date().toISOString();
  const gates: GateResult[] = [];

  yield step("rag", "start", timestamp());
  const ragStarted = Date.now();
  const { refs } = await ragSearch({ rag: deps.rag }, { request });
  gates.push({
    step: "rag",
    status: refs.length > 0 ? "passed" : "failed",
    duration_ms: Date.now() - ragStarted,
    evidence: { refs: refs.length },
    failure_detail:
      refs.length > 0
        ? undefined
        : { code: "no_refs", message: "No reference problems found" },
  });
  yield step("rag", refs.length > 0 ? "done" : "info", timestamp());
  if (refs.length === 0) {
    yield {
      type: "error",
      stage: "rag",
      code: "no_refs",
      message: "No reference problems found",
      recoverable: true,
      timestamp: timestamp(),
    };
    return { verifications: [] };
  }

  const strategy = await loadStrategy(deps.strategies, refs, request);

  yield step("intent", "start", timestamp());
  const intentStarted = Date.now();
  const intent = buildSeedIntent(request, strategy, refs);
  gates.push({ step: "intent", status: "passed", duration_ms: Date.now() - intentStarted });
  yield step("intent", "done", timestamp());

  yield step("generate", "start", timestamp());
  const generateStarted = Date.now();
  const candidate = await buildCandidate(deps, request, intent, refs, strategy);
  gates.push({
    step: "generate",
    status: "passed",
    duration_ms: Date.now() - generateStarted,
    evidence: {
      candidate_id: candidate.candidate_id,
      model: candidate.generation_metadata.model,
    },
  });
  yield step("generate", "done", timestamp());

  yield step("sympy_verify", "start", timestamp());
  const sympy = await verifyWithSympy({ mathEngine: deps.mathEngine }, { candidate });
  gates.push(sympy.gate);
  yield step("sympy_verify", sympy.gate.status === "passed" ? "done" : "info", timestamp());

  yield step("re_solve", "start", timestamp());
  gates.push({ step: "re_solve", status: "skipped", duration_ms: 0 });
  yield step("re_solve", "done", timestamp());

  yield step("objective_map", "start", timestamp());
  const objectiveStarted = Date.now();
  const objectiveGate = evaluateObjectiveMap({
    request,
    strategy,
    refs,
    candidate,
    startedAt: objectiveStarted,
  });
  gates.push(objectiveGate);
  yield step("objective_map", objectiveGate.status === "passed" ? "done" : "info", timestamp());

  const acceptance = createAcceptancePolicy();
  const verification: Verification = {
    candidate_id: candidate.candidate_id,
    overall: acceptance.decide(gates, 1),
    gates,
    attempt_count: 1,
  };
  assertVerificationInvariants(verification);

  yield {
    type: "result",
    candidates: [{ problem: candidate, verification }],
    timestamp: timestamp(),
  };

  return { verifications: [verification] };
}

function step(
  stepName: StepName,
  status: StepStatus,
  timestamp: string,
): ProgressEvent {
  return { type: "step", step: stepName, status, timestamp };
}

async function loadStrategy(
  loader: StrategyLoader,
  refs: RagResult[],
  request: GenerateRequest,
): Promise<Strategy | null> {
  const code = getGenerateRequestTopicCode(request) || refs[0]?.problem.achievement_standard;
  if (code === undefined || code === null) return null;
  return loader.load(code);
}

function buildSeedIntent(
  request: GenerateRequest,
  strategy: Strategy | null,
  refs: RagResult[],
): Intent {
  const first = refs[0];
  if (first === undefined) {
    throw new Error("Cannot build intent without RAG refs");
  }
  const objectiveCode = strategy?.code ?? first.problem.achievement_standard;
  if (objectiveCode === null) {
    throw new Error("Cannot build intent without achievement standard");
  }
  return {
    objective_code: objectiveCode,
    objective_description: strategy?.title ?? first.problem.topic_name,
    evaluation_dimensions:
      strategy?.evaluation_dimensions ??
      request.dims.map((description, index) => ({
        id: String.fromCharCode(65 + index),
        description,
        must_preserve: true,
      })),
    required_techniques: strategy?.techniques.required_at_least_one_of ?? [],
    forbidden_techniques: strategy?.techniques.forbidden ?? [],
    surface_constraints: {
      difficulty: request.difficulty,
      problem_type: request.problem_type,
    },
  };
}

function buildSeedCandidate(
  request: GenerateRequest,
  intent: Intent,
  refs: RagResult[],
  _strategy: Strategy | null,
): GeneratedProblem {
  const first = refs[0];
  if (first === undefined) {
    throw new Error("Cannot build candidate without RAG refs");
  }
  return {
    candidate_id: randomUUID(),
    mode: request.mode === "conceptual" ? "conceptual" : "structural",
    question_text: first.problem.question_text,
    expected_answer: first.problem.answer_text,
    proposed_solution_trace: first.problem.explanation_text ?? "",
    source_refs: [first.item_id],
    inferred_intent: intent,
    generation_metadata: {
      model: "seed-workflow",
      temperature: 0,
      prompt_id: "seed-workflow",
      prompt_version: "0.0.0",
      attempt: 0,
      generated_at: new Date().toISOString(),
    },
  };
}

async function buildCandidate(
  deps: VerificationWorkflowDeps,
  request: GenerateRequest,
  intent: Intent,
  refs: RagResult[],
  strategy: Strategy | null,
): Promise<GeneratedProblem> {
  if (deps.generator === undefined) {
    return buildSeedCandidate(request, intent, refs, strategy);
  }
  const generated = await deps.generator.generate({
    request,
    intent,
    refs,
    strategy,
    attempt: 1,
  });
  return normalizeExpectedAnswer(deps.mathEngine, generated);
}

async function normalizeExpectedAnswer(
  mathEngine: MathEngineClient,
  candidate: GeneratedProblem,
): Promise<GeneratedProblem> {
  if (!candidate.question_text.includes("=")) return candidate;
  const solved = await mathEngine.solve({ equation: candidate.question_text });
  if (solved.solutions.length === 0) return candidate;
  return {
    ...candidate,
    expected_answer: solved.solutions.join(", "),
  };
}

function evaluateObjectiveMap(input: {
  request: GenerateRequest;
  strategy: Strategy | null;
  refs: RagResult[];
  candidate: GeneratedProblem;
  startedAt: number;
}): GateResult {
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

  return {
    step: "objective_map",
    status: failures.length === 0 ? "passed" : "failed",
    duration_ms: Date.now() - input.startedAt,
    evidence: {
      refs: refs.length,
      mode: request.mode,
      source_problem_text: request.source_problem_text ?? null,
      strategy_code: strategy?.code ?? null,
      difficulty: request.difficulty,
      problem_type: request.problem_type,
    },
    failure_detail:
      failures.length === 0
        ? undefined
        : {
            code: failures[0]?.code ?? "objective_map_failed",
            message: failures.map((failure) => failure.message).join("; "),
          },
  };
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
