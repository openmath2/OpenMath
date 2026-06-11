/** Service entrypoint. Wiring of deps -> createApp is the only un-implemented part of scaffolding. */

import { serve } from "@hono/node-server";
import { resolve } from "node:path";

import { loadEnv } from "./config/index.js";
import { DEFAULT_MODELS } from "./config/models.js";
import { createApp } from "./server/app.js";
import {
  createClassifierAgent,
  createConstraintCriticAgent,
  createExtractorAgent,
  createGeneratorAgent,
  createRefinerAgent,
  createSolverAgent,
} from "./agents/index.js";
import {
  createFsPromptLoader,
  createFsRunTraceWriter,
  createFsStrategyLoader,
  createInMemoryRagClient,
  createMathEngineClient,
  resolveLanguageModel,
  withLlmLogging,
  type LlmCallRecord,
} from "./tools/index.js";

export async function main(): Promise<void> {
  const env = loadEnv();
  const trace = createFsRunTraceWriter({
    dir: resolve(env.TRACE_DIR),
    enabled: env.TRACE_ENABLED === "true",
  });
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
    jsonlPath: resolve(env.CORPUS_JSONL ?? "./data/corpus/math-sample-unified-v1.jsonl"),
  });
  await rag.warmup?.();

  const llmKind = env.LLM_PROVIDER === "cliproxy" ? "openai-compatible" : env.LLM_PROVIDER;
  const llmBaseUrl = env.LLM_BASE_URL ?? env.CLIPROXY_BASE_URL;
  const llmApiKey = env.LLM_API_KEY ?? env.CLIPROXY_API_KEY ?? env.OPENAI_API_KEY;
  const llmModel = env.LLM_MODEL ?? env.CLIPROXY_MODEL ?? env.OPENAI_MODEL ?? DEFAULT_MODELS.generator;
  const logLlmCall = (record: LlmCallRecord): void => {
    void trace.append("llm", record);
  };
  const llm = llmBaseUrl !== undefined || llmApiKey !== undefined
    ? withLlmLogging(
        resolveLanguageModel({
          kind: llmKind,
          modelId: llmModel,
          baseUrl: llmBaseUrl,
          apiKey: llmApiKey ?? "openmath-local",
          allowedHosts: ["localhost", "127.0.0.1"],
        }),
        llmModel,
        logLlmCall,
      )
    : undefined;
  const solverModel = env.SOLVER_MODEL ?? llmModel;
  const solverLlm = llm === undefined
    ? undefined
    : solverModel === llmModel
      ? llm
      : withLlmLogging(
          resolveLanguageModel({
            kind: llmKind,
            modelId: solverModel,
            baseUrl: llmBaseUrl,
            apiKey: llmApiKey ?? "openmath-local",
            allowedHosts: ["localhost", "127.0.0.1"],
          }),
          `${solverModel} (solver)`,
          logLlmCall,
        );
  const generator = llm === undefined
    ? undefined
    : createGeneratorAgent({
        model: llm,
        modelId: llmModel,
        promptId: "problem-generator",
        prompts,
      });
  const critic = llm === undefined
    ? undefined
    : createConstraintCriticAgent({
        model: llm,
        modelId: llmModel,
        promptId: "constraint-critic",
        prompts,
      });
  const refiner = llm === undefined
    ? undefined
    : createRefinerAgent({
        model: llm,
        modelId: llmModel,
        promptId: "refiner",
        prompts,
      });
  const solver = solverLlm === undefined
    ? undefined
    : createSolverAgent({
        model: solverLlm,
        modelId: solverModel,
        promptId: "independent-solver",
        prompts,
      });
  const extractModel = env.EXTRACT_MODEL ?? llmModel;
  const extractLlm = llm === undefined
    ? undefined
    : extractModel === llmModel
      ? llm
      : withLlmLogging(
          resolveLanguageModel({
            kind: llmKind,
            modelId: extractModel,
            baseUrl: llmBaseUrl,
            apiKey: llmApiKey ?? "openmath-local",
            allowedHosts: ["localhost", "127.0.0.1"],
          }),
          `${extractModel} (extract)`,
          logLlmCall,
        );
  const extractor = extractLlm === undefined
    ? undefined
    : createExtractorAgent({
        model: extractLlm,
        modelId: extractModel,
        promptId: "problem-extractor",
        prompts,
      });
  const classifier = llm === undefined
    ? undefined
    : createClassifierAgent({
        model: llm,
        modelId: llmModel,
        promptId: "problem-classifier",
        prompts,
      });

  const app = createApp({
    mathEngine,
    rag,
    extract: { extractor, classifier },
    workflow: {
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
    },
    workflowOptions: {
      maxRetries: env.MAX_RETRIES,
      perStepTimeoutMs: env.PER_STEP_TIMEOUT_MS,
      deterministicFallback: env.DETERMINISTIC_FALLBACK,
    },
    trace,
  });

  serve({ fetch: app.fetch, port: env.PORT });
  console.log(
    `[openmath/agent] Listening on http://localhost:${env.PORT} (math-engine ${env.MATH_ENGINE_URL})`,
  );
  console.log(
    `[openmath/agent] generator=${llmModel} solver=${solverModel} fallback=${env.DETERMINISTIC_FALLBACK} trace=${env.TRACE_ENABLED === "true" ? resolve(env.TRACE_DIR) : "off"}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export type { Env } from "./config/index.js";
export * from "./schemas/index.js";
