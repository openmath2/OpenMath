/** GET /health — service liveness + math-engine reachability. */

import { Hono } from "hono";

import type { MathEngineClient } from "../../tools/math-engine-client.js";

export function createHealthRoute(_mathEngine: MathEngineClient): Hono {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({ status: "ok", service: "openmath-agent" });
  });

  return app;
}
