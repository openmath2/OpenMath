/** POST /api/generate — SSE streaming endpoint (D-6).
 *  Validates GenerateRequest, runs runVerificationWorkflow, pipes events. */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { GenerateRequestSchema } from "../../schemas/index.js";
import type { RunTraceWriter } from "../../tools/run-trace.js";
import { pipeParallelProgressToSse } from "../sse/progress-stream.js";
import type { RunOptions, VerificationWorkflowDeps } from "../../workflows/verification-workflow.js";
import { runVerificationWorkflow } from "../../workflows/verification-workflow.js";

const MAX_PARALLEL_GENERATIONS = 3;

export function createGenerateRoute(
  deps: VerificationWorkflowDeps,
  options?: RunOptions,
  trace?: RunTraceWriter,
): Hono {
  const app = new Hono();

  app.post(
    "/api/generate",
    zValidator("json", GenerateRequestSchema),
    (c) => {
      const request = c.req.valid("json");
      const count = Math.min(Math.max(request.count, 1), MAX_PARALLEL_GENERATIONS);
      return streamSSE(c, async (stream) => {
        const runs = Array.from({ length: count }, () =>
          runVerificationWorkflow(deps, request, options),
        );
        await pipeParallelProgressToSse(stream, runs, { trace, request });
      });
    },
  );

  return app;
}
