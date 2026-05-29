/** POST /api/generate — SSE streaming endpoint (D-6).
 *  Validates GenerateRequest, runs runVerificationWorkflow, pipes events. */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { GenerateRequestSchema } from "../../schemas/index.js";
import type { VerificationWorkflowDeps } from "../../workflows/verification-workflow.js";
import { runVerificationWorkflow } from "../../workflows/verification-workflow.js";
import { pipeProgressToSse } from "../sse/progress-stream.js";

export function createGenerateRoute(deps: VerificationWorkflowDeps): Hono {
  const app = new Hono();

  app.post(
    "/api/generate",
    zValidator("json", GenerateRequestSchema),
    (c) => {
      const request = c.req.valid("json");
      const events = runVerificationWorkflow(deps, request);
      return streamSSE(c, async (stream) => {
        await pipeProgressToSse(stream, events);
      });
    },
  );

  return app;
}
