/**
 * Real-LLM end-to-end smoke (plan task 4-4).
 *
 * Drives ONE demo unit through the live `runVerificationWorkflow` against the
 * real LLM (per `.env`) and the real `math-engine` at `MATH_ENGINE_URL`. This
 * is the safety net that proves the full 6-gate pipeline produces a terminal
 * verdict for the capstone demo unit (`9수02-09` / 중3 / structural).
 *
 * Skipped by default — only runs when `LLM_E2E=1` is set. CI and the normal
 * `pnpm -F @openmath/agent test:integration` run will mark it skipped to
 * avoid burning LLM budget. The orchestrator runs it with `LLM_E2E=1` before
 * the demo when `pnpm dev:all` is up.
 *
 * Set-up the test expects (when enabled):
 *  - `packages/agent/.env` has valid `LLM_*` (or `CLIPROXY_*` / `OPENAI_*`)
 *  - `math-engine` is reachable at `MATH_ENGINE_URL` (default localhost:16180)
 *  - The CLIProxyAPI / OpenAI provider can answer in <240s
 */

import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createConstraintCriticAgent,
  createGeneratorAgent,
  createRefinerAgent,
  createSolverAgent,
} from "../../src/agents/index.js";
import { DEFAULT_MODELS, loadEnv } from "../../src/config/index.js";
import type {
  GenerateRequest,
  ProgressEvent,
  ResultEvent,
} from "../../src/schemas/index.js";
import {
  createFsPromptLoader,
  createFsStrategyLoader,
  createInMemoryRagClient,
  createMathEngineClient,
  resolveLanguageModel,
} from "../../src/tools/index.js";
import {
  runVerificationWorkflow,
  type VerificationWorkflowDeps,
} from "../../src/workflows/verification-workflow.js";

const E2E_ENABLED = process.env.LLM_E2E === "1";

/** Per-test budget. The real LLM (CLIProxyAPI / GPT-5.5(xhigh)) is slow. */
const E2E_TEST_TIMEOUT_MS = 240_000;

/** Outer wall-clock guard. Bigger than the test timeout — if vitest's own
 *  timeout fires first that's fine; this exists so a stuck network/LLM
 *  call surfaces as a clear assertion error instead of a vitest hang. */
const E2E_OVERALL_TIMEOUT_MS = 230_000;

describe.skipIf(!E2E_ENABLED)("real LLM end-to-end (LLM_E2E=1)", () => {
  it(
    "drives one demo unit through runVerificationWorkflow and produces a terminal verdict",
    async () => {
      const { workflowDeps, request, runOptions } = await buildRealWorkflow();

      const result = await drainWorkflowWithDeadline(
        workflowDeps,
        request,
        runOptions,
        E2E_OVERALL_TIMEOUT_MS,
      );

      const resultEvent = result.events.find(
        (event): event is ResultEvent => event.type === "result",
      );
      const errorEvents = result.events.filter(
        (event) => event.type === "error",
      );

      if (resultEvent === undefined) {
        throw new Error(
          `runVerificationWorkflow ended without a result event. errors=${JSON.stringify(
            errorEvents,
          )}, events=${result.events.length}`,
        );
      }

      expect(resultEvent.candidates.length).toBeGreaterThan(0);
      const [candidate] = resultEvent.candidates;
      if (candidate === undefined) {
        throw new Error("result event had no candidate problem");
      }

      expect(candidate.problem.question_text.trim().length).toBeGreaterThan(0);
      expect(candidate.problem.expected_answer.trim().length).toBeGreaterThan(0);

      const overall = candidate.verification.overall;
      expect(["verified", "warning", "rejected"]).toContain(overall);

      if (overall === "verified") {
        const sympy = candidate.verification.gates.find(
          (gate) => gate.step === "sympy_verify",
        );
        const objMap = candidate.verification.gates.find(
          (gate) => gate.step === "objective_map",
        );
        expect(sympy?.status).toBe("passed");
        expect(objMap?.status).toBe("passed");
      }
    },
    E2E_TEST_TIMEOUT_MS,
  );
});

interface RealWorkflowBundle {
  workflowDeps: VerificationWorkflowDeps;
  request: GenerateRequest;
  runOptions: NonNullable<Parameters<typeof runVerificationWorkflow>[2]>;
}

/** Mirror `src/index.ts` wiring with one delta: force
 *  `DETERMINISTIC_FALLBACK=off` so the LLM generator path is exercised
 *  end-to-end (no template short-circuit). */
async function buildRealWorkflow(): Promise<RealWorkflowBundle> {
  const env = loadEnv();

  const mathEngine = createMathEngineClient({
    baseUrl: env.MATH_ENGINE_URL,
    timeoutMs: env.PER_STEP_TIMEOUT_MS,
    retry: { attempts: 2, backoffMs: 100 },
  });

  const prompts = createFsPromptLoader({ promptsDir: resolve(env.PROMPTS_DIR) });
  const strategies = createFsStrategyLoader({
    strategiesDir: resolve(env.STRATEGIES_DIR),
  });

  const rag = createInMemoryRagClient({
    jsonlPath: resolve(
      env.CORPUS_JSONL ?? "./data/corpus/math-sample-unified-v1.jsonl",
    ),
  });
  await rag.warmup?.();

  const llm = buildLanguageModel(env);
  if (llm === undefined) {
    throw new Error(
      "LLM_E2E=1 requires a configured LLM provider. Populate packages/agent/.env (LLM_BASE_URL/LLM_API_KEY/LLM_MODEL or OPENAI_API_KEY).",
    );
  }
  const llmModelId = pickLlmModelId(env);

  const solverModelId = env.SOLVER_MODEL ?? llmModelId;
  const solverLlm =
    solverModelId === llmModelId
      ? llm
      : resolveLanguageModel({
          kind: pickLlmKind(env),
          modelId: solverModelId,
          baseUrl: pickBaseUrl(env),
          apiKey: pickApiKey(env) ?? "openmath-local",
          allowedHosts: ["localhost", "127.0.0.1"],
        });

  const generator = createGeneratorAgent({
    model: llm,
    modelId: llmModelId,
    promptId: "problem-generator",
    prompts,
  });
  const critic = createConstraintCriticAgent({
    model: llm,
    modelId: llmModelId,
    promptId: "constraint-critic",
    prompts,
  });
  const refiner = createRefinerAgent({
    model: llm,
    modelId: llmModelId,
    promptId: "refiner",
    generator,
  });
  const solver = createSolverAgent({
    model: solverLlm,
    modelId: solverModelId,
    promptId: "independent-solver",
    prompts,
  });

  const workflowDeps: VerificationWorkflowDeps = {
    rag,
    mathEngine,
    prompts,
    strategies,
    intentModel: llm,
    generator,
    critic,
    refiner,
    solver,
    objectiveLlm: llm,
  };

  // Demo unit: 중3 / 이차방정식 / structural (per DEMO_SCOPE.md).
  const request: GenerateRequest = {
    mode: "structural",
    school_level: "middle",
    grade: 3,
    topic: "9수02-09",
    topic_code: "9수02-09",
    dims: [],
    count: 1,
    difficulty: "medium",
    problem_type: "objective",
  };

  return {
    workflowDeps,
    request,
    runOptions: {
      maxRetries: env.MAX_RETRIES,
      perStepTimeoutMs: env.PER_STEP_TIMEOUT_MS,
      // Force LLM path. Do NOT short-circuit to the deterministic template.
      deterministicFallback: "off",
    },
  };
}

function buildLanguageModel(env: ReturnType<typeof loadEnv>) {
  const kind = pickLlmKind(env);
  const baseUrl = pickBaseUrl(env);
  const apiKey = pickApiKey(env);
  const modelId = pickLlmModelId(env);
  if (baseUrl === undefined && apiKey === undefined) {
    return undefined;
  }
  return resolveLanguageModel({
    kind,
    modelId,
    baseUrl,
    apiKey: apiKey ?? "openmath-local",
    allowedHosts: ["localhost", "127.0.0.1"],
  });
}

function pickLlmKind(env: ReturnType<typeof loadEnv>) {
  return env.LLM_PROVIDER === "cliproxy" ? "openai-compatible" : env.LLM_PROVIDER;
}

function pickBaseUrl(env: ReturnType<typeof loadEnv>) {
  return env.LLM_BASE_URL ?? env.CLIPROXY_BASE_URL;
}

function pickApiKey(env: ReturnType<typeof loadEnv>) {
  return env.LLM_API_KEY ?? env.CLIPROXY_API_KEY ?? env.OPENAI_API_KEY;
}

function pickLlmModelId(env: ReturnType<typeof loadEnv>) {
  return (
    env.LLM_MODEL ??
    env.CLIPROXY_MODEL ??
    env.OPENAI_MODEL ??
    DEFAULT_MODELS.generator
  );
}

interface DrainResult {
  events: ProgressEvent[];
}

/** Drain the workflow generator with a hard wall-clock deadline. If the LLM
 *  or math-engine is unreachable the deadline turns a silent hang into a loud
 *  error pointing at the stuck step. */
async function drainWorkflowWithDeadline(
  deps: VerificationWorkflowDeps,
  request: GenerateRequest,
  options: NonNullable<Parameters<typeof runVerificationWorkflow>[2]>,
  deadlineMs: number,
): Promise<DrainResult> {
  const events: ProgressEvent[] = [];
  const generator = runVerificationWorkflow(deps, request, options);

  const deadline = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            `runVerificationWorkflow exceeded ${deadlineMs}ms (last event: ${
              describeLastEvent(events) ?? "none"
            }). LLM or math-engine likely unreachable.`,
          ),
        ),
      deadlineMs,
    ).unref();
  });

  while (true) {
    const next = await Promise.race([generator.next(), deadline]);
    if (next.done === true) {
      break;
    }
    events.push(next.value);
  }
  return { events };
}

function describeLastEvent(events: readonly ProgressEvent[]): string | undefined {
  const last = events.at(-1);
  if (last === undefined) return undefined;
  if (last.type === "step") return `step ${last.step}/${last.status}`;
  return last.type;
}
