/** Hono app composition. Wires routes + middlewares. Boots from src/index.ts. */

import { Hono } from "hono";
import { cors } from "hono/cors";

import type { MathEngineClient } from "../tools/math-engine-client.js";
import type { RagClient } from "../tools/rag-client.js";
import type { RunTraceWriter } from "../tools/run-trace.js";
import type { RunOptions, VerificationWorkflowDeps } from "../workflows/verification-workflow.js";
import { createGenerateRoute } from "./routes/generate.js";
import { createHealthRoute } from "./routes/health.js";
import { createSourceProblemsRoute } from "./routes/source-problems.js";

export interface AppDeps {
  mathEngine: MathEngineClient;
  rag: RagClient;
  workflow: VerificationWorkflowDeps;
  workflowOptions?: RunOptions;
  trace?: RunTraceWriter;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: ["http://localhost:27182", "http://127.0.0.1:27182"],
      allowHeaders: ["Content-Type", "Accept"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.route("/", createHealthRoute(deps.mathEngine));
  app.route("/", createSourceProblemsRoute(deps.rag));
  app.route("/", createGenerateRoute(deps.workflow, deps.workflowOptions, deps.trace));

  return app;
}
