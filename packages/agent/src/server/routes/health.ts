/** GET /health — service liveness + math-engine reachability. */

import { Hono } from "hono";

import type { MathEngineClient } from "../../tools/math-engine-client.js";

export function createHealthRoute(mathEngine: MathEngineClient): Hono {
  const app = new Hono();

  app.get("/health", async (c) => {
    try {
      await mathEngine.health();
      return c.json({ status: "ok", math_engine: "ok" }, 200);
    } catch (err) {
      return c.json(
        {
          status: "degraded",
          math_engine: "down",
          error: err instanceof Error ? err.message : String(err),
        },
        503,
      );
    }
  });

  return app;
}
