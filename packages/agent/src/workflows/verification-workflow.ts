/** Verification workflow — deterministic Orchestrator (D-5 outer skeleton).
 *  Owns the user-visible 6-step progress. Streams ProgressEvent via async generator. */

import type { LanguageModel } from "ai";

import type {
  ConstraintCriticAgent,
  GeneratorAgent,
  RefinerAgent,
  SolverAgent,
} from "../agents/index.js";
import type { DeterministicFallbackMode } from "../config/env.js";
import { createAcceptancePolicy } from "../policies/acceptance-policy.js";
import { createBoundedRetryPolicy } from "../policies/retry-policy.js";
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
import { assertVerificationInvariants, getGenerateRequestTopicCode } from "../schemas/index.js";
import { extractIntent } from "../steps/intent-extraction.js";
import { independentResolve } from "../steps/independent-resolve.js";
import { mapObjective } from "../steps/objective-mapping.js";
import { generateProblem } from "../steps/problem-generation.js";
import { deterministicInitialCandidate } from "../steps/problem-generation-deterministic.js";
import { ragSearch } from "../steps/rag-search.js";
import { verifyWithSympy } from "../steps/sympy-verification.js";
import type { MathEngineClient } from "../tools/math-engine-client.js";
import type { PromptLoader } from "../tools/prompt-loader.js";
import type { RagClient } from "../tools/rag-client.js";
import type { StrategyLoader } from "../tools/schema-loader.js";

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
  deterministicFallback?: DeterministicFallbackMode;
}

export type WorkflowYield = ProgressEvent;

export type WorkflowReturn = {
  verifications: Verification[];
};

export async function* runVerificationWorkflow(
  deps: VerificationWorkflowDeps,
  request: GenerateRequest,
  options?: RunOptions,
): AsyncGenerator<WorkflowYield, WorkflowReturn, void> {
  assertRequiredDeps(deps);

  const timestamp = () => new Date().toISOString();
  const perStepTimeoutMs = options?.perStepTimeoutMs ?? 30_000;
  const deterministicFallback: DeterministicFallbackMode =
    options?.deterministicFallback ?? "first";
  const maxAttempts = options?.maxRetries ?? 3;
  const retryPolicy = createBoundedRetryPolicy({ maxAttempts });
  const acceptance = createAcceptancePolicy({ maxAttempts });
  const verifications: Verification[] = [];

  yield step("rag", "start", timestamp());
  const ragStarted = Date.now();
  const { refs } = await ragSearch({ rag: deps.rag, perStepTimeoutMs }, { request });
  const ragGate: GateResult = {
    step: "rag",
    status: refs.length > 0 ? "passed" : "failed",
    duration_ms: Date.now() - ragStarted,
    evidence: { refs: refs.length },
    failure_detail:
      refs.length > 0
        ? undefined
        : { code: "no_refs", message: "No reference problems found" },
  };
  yield step("rag", "done", timestamp(), ragGate);
  if (refs.length === 0) {
    yield {
      type: "error",
      stage: "rag",
      code: "no_refs",
      message: "No reference problems found",
      recoverable: true,
      timestamp: timestamp(),
    };
    return { verifications };
  }

  const strategy = await loadStrategy(deps.strategies, refs, request);

  yield step("intent", "start", timestamp());
  const intentStep = await extractIntent(
    { model: deps.intentModel, prompts: deps.prompts, perStepTimeoutMs },
    { request, refs, strategy },
  );
  yield step("intent", "done", timestamp(), intentStep.gate);

  let attempt = 1;
  let refinementHint: string | undefined;
  let counterexample: string | undefined;
  while (true) {
    yield step("generate", "start", timestamp());
    const generation = await generateProblem(
      {
        generator: deps.generator,
        critic: deps.critic,
        refiner: deps.refiner,
        mathEngine: deps.mathEngine,
        perStepTimeoutMs,
        maxCriticRounds: 2,
      },
      {
        request,
        intent: intentStep.data,
        refs,
        strategy,
        attempt,
        refinementHint,
        counterexample,
        deterministicFallback,
      },
    );
    const candidate = generation.data;
    yield step("generate", "done", timestamp(), generation.gate);

    yield step("sympy_verify", "start", timestamp());
    const sympy = await verifyWithSympy(
      { mathEngine: deps.mathEngine, perStepTimeoutMs },
      { candidate },
    );
    yield step("sympy_verify", "done", timestamp(), sympy.gate);

    yield step("re_solve", "start", timestamp());
    const reSolve = await independentResolve(
      { solver: deps.solver, mathEngine: deps.mathEngine, perStepTimeoutMs },
      { candidate, sympyGate: sympy.gate },
    );
    yield step("re_solve", "done", timestamp(), reSolve.gate);

    yield step("objective_map", "start", timestamp());
    const objective = await mapObjective(
      { llm: deps.objectiveLlm, prompts: deps.prompts, perStepTimeoutMs },
      { request, refs, candidate, intent: intentStep.data, strategy },
    );
    yield step("objective_map", "done", timestamp(), objective.gate);

    const gates = [
      ragGate,
      intentStep.gate,
      generation.gate,
      sympy.gate,
      reSolve.gate,
      objective.gate,
    ];
    const verification: Verification = {
      candidate_id: candidate.candidate_id,
      overall: acceptance.decide(gates, attempt),
      gates,
      attempt_count: attempt,
    };
    assertVerificationInvariants(verification);
    verifications.push(verification);

    const retry = retryPolicy.decide(verification);
    if (!retry.shouldRetry) {
      const finalResult = selectFinalResult({
        deterministicFallback,
        request,
        intent: intentStep.data,
        refs,
        attempt,
        candidate,
        verification,
      });
      if (finalResult.verification !== verification) {
        verifications[verifications.length - 1] = finalResult.verification;
      }
      yield {
        type: "result",
        candidates: [{ problem: finalResult.problem, verification: finalResult.verification }],
        timestamp: timestamp(),
      };
      return { verifications };
    }

    refinementHint = retry.refinementHint;
    counterexample = retry.counterexample;
    attempt = retry.nextAttempt;
    yield {
      type: "retry",
      attempt,
      reason: retry.refinementHint ?? "verification failed",
      timestamp: timestamp(),
    };
  }
}

function selectFinalResult(input: {
  readonly deterministicFallback: DeterministicFallbackMode;
  readonly request: GenerateRequest;
  readonly intent: Intent;
  readonly refs: readonly RagResult[];
  readonly attempt: number;
  readonly candidate: GeneratedProblem;
  readonly verification: Verification;
}): { problem: GeneratedProblem; verification: Verification } {
  if (input.deterministicFallback !== "last-resort") {
    return { problem: input.candidate, verification: input.verification };
  }
  if (input.verification.overall !== "rejected") {
    return { problem: input.candidate, verification: input.verification };
  }

  const fallback = deterministicInitialCandidate({
    request: input.request,
    intent: input.intent,
    refs: input.refs,
    attempt: input.attempt,
  });
  if (fallback === null) {
    return { problem: input.candidate, verification: input.verification };
  }

  const problem = withDeterministicGeneratorMarker(fallback);
  const verification = { ...input.verification, candidate_id: problem.candidate_id };
  assertVerificationInvariants(verification);
  return { problem, verification };
}

function withDeterministicGeneratorMarker(candidate: GeneratedProblem): GeneratedProblem {
  return {
    ...candidate,
    generation_metadata: {
      ...candidate.generation_metadata,
      refined_by: uniqueRefiners([
        ...(candidate.generation_metadata.refined_by ?? []),
        "deterministic-topic-generator",
      ]),
    },
  };
}

function uniqueRefiners(refiners: readonly string[]): string[] {
  return [...new Set(refiners)];
}

function step(
  stepName: StepName,
  status: StepStatus,
  timestamp: string,
  gate?: GateResult,
): ProgressEvent {
  if (gate === undefined) return { type: "step", step: stepName, status, timestamp };
  return { type: "step", step: stepName, status, timestamp, data: { gate } };
}

async function loadStrategy(
  loader: StrategyLoader,
  refs: RagResult[],
  request: GenerateRequest,
): Promise<Strategy | null> {
  const code = getGenerateRequestTopicCode(request) || refs[0]?.problem.achievement_standard;
  if (code === undefined || code === null || code.length === 0) return null;
  return loader.load(code);
}

function assertRequiredDeps(
  deps: VerificationWorkflowDeps,
): asserts deps is VerificationWorkflowDeps & {
  intentModel: LanguageModel;
  generator: GeneratorAgent;
  critic: ConstraintCriticAgent;
  refiner: RefinerAgent;
  solver: SolverAgent;
} {
  if (deps.intentModel === undefined) {
    throw new Error("Verification workflow requires intentModel; no seed intent fallback is available");
  }
  if (deps.generator === undefined) {
    throw new Error("Verification workflow requires generator; buildSeedCandidate fallback has been removed");
  }
  if (deps.critic === undefined) {
    throw new Error("Verification workflow requires constraint critic");
  }
  if (deps.refiner === undefined) {
    throw new Error("Verification workflow requires refiner");
  }
  if (deps.solver === undefined) {
    throw new Error("Verification workflow requires solver; re_solve is no longer skipped");
  }
}
