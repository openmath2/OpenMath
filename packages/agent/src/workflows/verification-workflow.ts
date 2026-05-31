/** Verification workflow — the deterministic Orchestrator (D-5 outer skeleton).
 *  Owns the user-visible 6-step progress. Streams ProgressEvent via async generator. */

import type {
  GenerateRequest,
  GenerateMode,
  GateResult,
  GeneratedProblem,
  IsomorphicMode,
  ProgressEvent,
  RagResult,
  SolveAttempt,
  Strategy,
  Verification,
} from "../schemas/index.js";
import { assertVerificationInvariants } from "../schemas/index.js";
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
import { extractIntent } from "../steps/intent-extraction.js";
import { independentResolve } from "../steps/independent-resolve.js";
import { mapObjective } from "../steps/objective-mapping.js";
import { generateProblem } from "../steps/problem-generation.js";
import { ragSearch } from "../steps/rag-search.js";
import { verifyWithSympy } from "../steps/sympy-verification.js";

export interface VerificationWorkflowDeps {
  rag: RagClient;
  mathEngine?: MathEngineClient;
  prompts?: PromptLoader;
  strategies?: StrategyLoader;

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
  const timestamp = (): string => new Date().toISOString();

  yield {
    type: "step",
    step: "rag",
    status: "start",
    timestamp: timestamp(),
  };

  const ragStarted = Date.now();
  const rag = await ragSearch({ rag: deps.rag }, { request });
  const ragGate: GateResult = {
    step: "rag",
    status: rag.refs.length > 0 ? "passed" : "failed",
    duration_ms: Date.now() - ragStarted,
    evidence: {
      count: rag.refs.length,
      fallback_used: rag.fallback_used,
    },
    ...(rag.refs.length > 0
      ? {}
      : {
          failure_detail: {
            code: "rag_no_refs",
            message: "No source references were found for the request.",
          },
        }),
  };

  yield {
    type: "step",
    step: "rag",
    status: "done",
    timestamp: timestamp(),
    data: {
      count: rag.refs.length,
      duration_ms: ragGate.duration_ms,
      fallback_used: rag.fallback_used,
      refs: rag.refs.map((ref) => ({
        item_id: ref.item_id,
        similarity: ref.similarity,
        match_reason: ref.match_reason,
        topic_name: ref.problem.topic_name,
      })),
    },
  };

  yield {
    type: "step",
    step: "intent",
    status: "start",
    timestamp: timestamp(),
    data: {
      source_ref_count: rag.refs.length,
    },
  };

  const intentStarted = Date.now();
  const strategy = await loadStrategyForRequest(deps, request);
  const { intent } = await extractIntent(
    { model: deps.intentModel, prompts: deps.prompts },
    {
      request,
      refs: rag.refs,
      strategy,
    },
  );
  const intentGate: GateResult = {
    step: "intent",
    status: "passed",
    duration_ms: Date.now() - intentStarted,
    evidence: {
      objective_code: intent.objective_code,
      evaluation_dimension_count: intent.evaluation_dimensions.length,
      strategy_loaded: strategy !== null,
    },
  };

  yield {
    type: "step",
    step: "intent",
    status: "done",
    timestamp: timestamp(),
    data: {
      duration_ms: intentGate.duration_ms,
      objective_code: intent.objective_code,
      objective_description: intent.objective_description,
      evaluation_dimension_count: intent.evaluation_dimensions.length,
      source_ref_count: rag.refs.length,
    },
  };

  if (deps.mathEngine === undefined) {
    yield {
      type: "error",
      stage: "orchestrator",
      code: "MISSING_MATH_ENGINE",
      message: "math-engine dependency is required to complete verification.",
      recoverable: false,
      timestamp: timestamp(),
    };
    return { verifications: [] };
  }

  const generator = deps.generator ?? createFallbackGenerator();
  const critic = deps.critic ?? createFallbackCritic();
  const refiner = deps.refiner ?? createFallbackRefiner();
  const solver = deps.solver ?? createFallbackSolver();
  const targetCount = request.count;

  yield {
    type: "step",
    step: "generate",
    status: "start",
    timestamp: timestamp(),
    data: { count: targetCount },
  };

  const generateStarted = Date.now();
  const generated = await Promise.all(
    Array.from({ length: targetCount }, async (_, index) => {
      const requestForAttempt = {
        ...request,
        mode: modeForAttempt(request.mode, index),
      };
      const output = await generateProblem(
        {
          generator,
          critic,
          refiner,
          maxCriticRounds: 2,
        },
        {
          request: requestForAttempt,
          intent,
          refs: rag.refs,
          strategy,
          attempt: index,
        },
      );
      return {
        ...output,
        gate: {
          step: "generate",
          status: "passed",
          duration_ms: Date.now() - generateStarted,
          evidence: { refined_by: output.refined_by },
        } satisfies GateResult,
      };
    }),
  );

  yield {
    type: "step",
    step: "generate",
    status: "done",
    timestamp: timestamp(),
    data: {
      count: generated.length,
      duration_ms: Date.now() - generateStarted,
    },
  };

  yield {
    type: "step",
    step: "sympy_verify",
    status: "start",
    timestamp: timestamp(),
    data: { count: generated.length },
  };

  const sympyStarted = Date.now();
  const withSympy = await Promise.all(
    generated.map(async (item) => ({
      ...item,
      sympy: await verifyWithSympy(
        { mathEngine: deps.mathEngine as NonNullable<typeof deps.mathEngine> },
        { candidate: item.candidate },
      ),
    })),
  );

  yield {
    type: "step",
    step: "sympy_verify",
    status: "done",
    timestamp: timestamp(),
    data: {
      passed: withSympy.filter((item) => item.sympy.gate.status === "passed").length,
      count: withSympy.length,
      duration_ms: Date.now() - sympyStarted,
    },
  };

  yield {
    type: "step",
    step: "re_solve",
    status: "start",
    timestamp: timestamp(),
    data: { count: withSympy.length },
  };

  const reSolveStarted = Date.now();
  const withReSolve = await Promise.all(
    withSympy.map(async (item) => ({
      ...item,
      reSolve: await independentResolve(
        {
          solver,
          mathEngine: deps.mathEngine as NonNullable<typeof deps.mathEngine>,
        },
        { candidate: item.candidate, sympyGate: item.sympy.gate },
      ),
    })),
  );

  yield {
    type: "step",
    step: "re_solve",
    status: "done",
    timestamp: timestamp(),
    data: {
      passed: withReSolve.filter((item) => item.reSolve.gate.status === "passed")
        .length,
      count: withReSolve.length,
      duration_ms: Date.now() - reSolveStarted,
    },
  };

  yield {
    type: "step",
    step: "objective_map",
    status: "start",
    timestamp: timestamp(),
    data: { count: withReSolve.length },
  };

  const objectiveStarted = Date.now();
  const finalItems = await Promise.all(
    withReSolve.map(async (item) => ({
      ...item,
      objective: await mapObjective(
        { llm: deps.objectiveLlm },
        { candidate: item.candidate, intent, strategy },
      ),
    })),
  );

  const verifications = finalItems.map((item) => {
    const verification = buildVerification({
      candidate: item.candidate,
      attemptCount: item.candidate.generation_metadata.attempt + 1,
      gates: [
        ragGate,
        intentGate,
        item.gate,
        item.sympy.gate,
        item.reSolve.gate,
        item.objective.gate,
      ],
    });
    assertVerificationInvariants(verification);
    return verification;
  });

  yield {
    type: "step",
    step: "objective_map",
    status: "done",
    timestamp: timestamp(),
    data: {
      passed: finalItems.filter((item) => item.objective.gate.status === "passed")
        .length,
      count: finalItems.length,
      duration_ms: Date.now() - objectiveStarted,
    },
  };

  yield {
    type: "result",
    candidates: finalItems.map((item, index) => ({
      problem: {
        ...item.candidate,
        generation_metadata: {
          ...item.candidate.generation_metadata,
          refined_by: item.refined_by,
        },
      },
      verification: verifications[index] as Verification,
    })),
    timestamp: timestamp(),
  };

  return { verifications };
}

async function loadStrategyForRequest(
  deps: VerificationWorkflowDeps,
  request: GenerateRequest,
): Promise<Strategy | null> {
  const code = request.topic_code ?? request.topic;
  if (deps.strategies === undefined || code === undefined) {
    return null;
  }
  return deps.strategies.load(code);
}

function buildVerification(input: {
  candidate: GeneratedProblem;
  gates: GateResult[];
  attemptCount: number;
}): Verification {
  const sympy = input.gates.find((gate) => gate.step === "sympy_verify");
  const reSolve = input.gates.find((gate) => gate.step === "re_solve");
  const objective = input.gates.find((gate) => gate.step === "objective_map");
  const deterministicPassed =
    sympy?.status === "passed" && objective?.status === "passed";
  const overall =
    deterministicPassed && reSolve?.status === "failed"
      ? "warning"
      : deterministicPassed
        ? "verified"
        : "rejected";

  return {
    candidate_id: input.candidate.candidate_id,
    overall,
    gates: input.gates,
    attempt_count: input.attemptCount,
    ...(overall === "rejected"
      ? {
          failure_reason: failureReasonFor(input.gates),
        }
      : {}),
  };
}

function failureReasonFor(gates: GateResult[]): Verification["failure_reason"] {
  const failed = gates.find((gate) => gate.status === "failed");
  if (failed?.step === "sympy_verify") {
    return {
      category: "arithmetic_error",
      user_message_ko: "생성된 정답이 수학 엔진의 풀이와 일치하지 않습니다.",
    };
  }
  if (failed?.step === "objective_map") {
    return {
      category: "learning_objective_mismatch",
      user_message_ko: "생성된 문항이 요청한 학습 목표에서 벗어났습니다.",
    };
  }
  return {
    category: "structural_error",
    user_message_ko: "검증 파이프라인에서 통과하지 못한 단계가 있습니다.",
  };
}

function createFallbackGenerator(): GeneratorAgent {
  return {
    async generate(input) {
      const mode: IsomorphicMode =
        input.request.mode === "conceptual" ? "conceptual" : "structural";
      const n = input.attempt + 2;
      const answer = n + 1;
      const ref = input.refs[0];
      return {
        candidate_id: fallbackUuid(input.attempt),
        mode,
        question_text: `방정식 x + ${n} = ${answer + n} 의 해를 구하여라.`,
        expected_answer: String(answer),
        expected_choices:
          input.request.problem_type === "objective"
            ? [String(answer - 2), String(answer - 1), String(answer), String(answer + 1), String(answer + 2)]
            : undefined,
        proposed_solution_trace: `양변에서 ${n}을 빼면 x = ${answer}이다.`,
        source_refs: input.refs.map((item) => item.item_id),
        inferred_intent: input.intent,
        generation_metadata: {
          model: "fallback-generator",
          temperature: 0,
          prompt_id: "fallback",
          prompt_version: "0.0.0",
          attempt: input.attempt,
          generated_at: new Date().toISOString(),
          refined_by: [],
        },
      };
    },
  };
}

function createFallbackCritic(): ConstraintCriticAgent {
  return {
    async critique() {
      return { passes: true, hints: [] };
    },
  };
}

function createFallbackRefiner(): RefinerAgent {
  return {
    async refine(input) {
      return input.prior;
    },
  };
}

function createFallbackSolver(): SolverAgent {
  return {
    async solve(candidate): Promise<SolveAttempt> {
      return {
        derived_answer: candidate.expected_answer,
        trace: candidate.proposed_solution_trace,
        confidence: "high",
      };
    },
  };
}

function fallbackUuid(attempt: number): string {
  return `00000000-0000-4000-8000-${String(attempt + 1).padStart(12, "0")}`;
}

function modeForAttempt(mode: GenerateMode, attempt: number): Exclude<GenerateMode, "auto"> {
  if (mode === "auto") {
    return attempt % 2 === 0 ? "structural" : "conceptual";
  }
  return mode;
}
