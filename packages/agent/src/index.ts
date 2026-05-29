/** Service entrypoint. Wires runtime deps and starts the Hono server. */

import { access } from "node:fs/promises";

import { serve } from "@hono/node-server";

import { createApp } from "./server/app.js";
import { loadEnv } from "./config/index.js";
import { createMathEngineClient } from "./tools/math-engine-client.js";
import { createInMemoryRagClient } from "./tools/rag-client.js";

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

  const app = createApp({
    mathEngine,
    workflow: { rag, mathEngine },
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
