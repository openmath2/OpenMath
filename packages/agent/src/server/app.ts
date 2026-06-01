/** Hono app composition. Wires routes + middlewares. Boots from src/index.ts. */

import { Hono } from "hono";

import type { MathEngineClient } from "../tools/math-engine-client.js";
import type { VerificationWorkflowDeps } from "../workflows/verification-workflow.js";
import { createGenerateRoute } from "./routes/generate.js";
import { createHealthRoute } from "./routes/health.js";
import { createVerifyPartialRoute } from "./routes/verify-partial.js";

export interface AppDeps {
  mathEngine: MathEngineClient;
  workflow: VerificationWorkflowDeps;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.route("/", createHealthRoute(deps.mathEngine));
  app.route("/", createGenerateRoute(deps.workflow));
  /* OM-82: partial re-verification (sympy_verify + re_solve 만 재실행).
   * mathEngine / solver 는 workflow 가 이미 가진 인스턴스를 재사용 (동일 인스턴스 보장). */
  app.route(
    "/",
    createVerifyPartialRoute({
      mathEngine: deps.workflow.mathEngine,
      solver: deps.workflow.solver,
    }),
  );

  return app;
}
