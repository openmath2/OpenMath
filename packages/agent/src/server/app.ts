/** Hono app composition. Wires routes + middlewares. Boots from src/index.ts. */

import { Hono } from "hono";

import type { MathEngineClient } from "../tools/math-engine-client.js";
import type { VerificationWorkflowDeps } from "../workflows/verification-workflow.js";
import { createGenerateRoute } from "./routes/generate.js";
import { createHealthRoute } from "./routes/health.js";

export interface AppDeps {
  mathEngine: MathEngineClient;
  workflow: VerificationWorkflowDeps;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.route("/", createHealthRoute(deps.mathEngine));
  app.route("/", createGenerateRoute(deps.workflow));

  return app;
}
