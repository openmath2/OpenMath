/** Service entrypoint. Wires runtime deps and starts the Hono server. */

import { access } from "node:fs/promises";

import { serve } from "@hono/node-server";

import { createApp } from "./server/app.js";
import { loadEnv } from "./config/index.js";
import {
  createConstraintCriticAgent,
  createGeneratorAgent,
  createRefinerAgent,
  createSolverAgent,
} from "./agents/index.js";
import { createMathEngineClient } from "./tools/math-engine-client.js";
import { resolveLanguageModel } from "./tools/llm-provider.js";
import { createFsPromptLoader } from "./tools/prompt-loader.js";
import { createInMemoryRagClient } from "./tools/rag-client.js";
import { createFsStrategyLoader } from "./tools/schema-loader.js";

export async function main(): Promise<void> {
  const env = loadEnv();

  if (!env.CORPUS_JSONL) {
    throw new Error(
      "CORPUS_JSONL is required to start the agent with RAG search. " +
        "Set it to the openmath_rag_records.jsonl file path.",
    );
  }

  await access(env.CORPUS_JSONL);

  const rag = createInMemoryRagClient({ jsonlPath: env.CORPUS_JSONL });
  await rag.warmup?.();

  const mathEngine = createMathEngineClient({
    baseUrl: env.MATH_ENGINE_URL,
    timeoutMs: env.PER_STEP_TIMEOUT_MS,
  });
  const prompts = createFsPromptLoader({ promptsDir: env.PROMPTS_DIR });
  const strategies = createFsStrategyLoader({ strategiesDir: env.STRATEGIES_DIR });
  const model = maybeResolveModel(env);
  const agentDeps =
    model === null
      ? {}
      : {
          intentModel: model,
          generator: createGeneratorAgent({ model, prompts }),
          critic: createConstraintCriticAgent({ model, prompts }),
          refiner: createRefinerAgent({ model, prompts }),
          solver: createSolverAgent({ model, prompts }),
          objectiveLlm: model,
        };

  const app = createApp({
    mathEngine,
    workflow: { rag, mathEngine, prompts, strategies, ...agentDeps },
  });

  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(
      `[openmath/agent] Listening on http://localhost:${info.port}; ` +
        `math-engine ${env.MATH_ENGINE_URL}; corpus ${env.CORPUS_JSONL}`,
    );
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export type { Env } from "./config/index.js";
export * from "./schemas/index.js";

function maybeResolveModel(env: ReturnType<typeof loadEnv>) {
  if (env.LLM_PROVIDER === "openai" && !env.LLM_API_KEY && !process.env.OPENAI_API_KEY) {
    console.warn("[openmath/agent] LLM_API_KEY missing; using fallback generator.");
    return null;
  }
  if (env.LLM_PROVIDER !== "openai" && env.LLM_BASE_URL === undefined) {
    console.warn("[openmath/agent] LLM_BASE_URL missing; using fallback generator.");
    return null;
  }
  return resolveLanguageModel({
    kind: env.LLM_PROVIDER,
    modelId: env.LLM_MODEL,
    baseUrl: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
  });
}
