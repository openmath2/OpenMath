/** POST /api/generate — SSE streaming endpoint (D-6).
 *  Validates GenerateRequest, runs runVerificationWorkflow, pipes events. */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { GenerateRequestSchema } from "../../schemas/index.js";
import type { VerificationWorkflowDeps } from "../../workflows/verification-workflow.js";

export function createGenerateRoute(_deps: VerificationWorkflowDeps): Hono {
  const app = new Hono();

  app.post(
    "/api/generate",
    zValidator("json", GenerateRequestSchema),
    () => {
      throw new Error("POST /api/generate: not implemented yet");
    },
  );

  return app;
}
