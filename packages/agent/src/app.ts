import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { agentRoutes } from "./routes/agent.js";
import { healthRoutes } from "./routes/health.js";

export function createApp() {
  const app = new Hono();

  app.use("*", logger());
  app.use("*", cors());

  app.route("/health", healthRoutes);
  app.route("/api/agent", agentRoutes);

  app.get("/", (c) => {
    return c.json({
      name: "OpenMath Agent API",
      version: "0.1.0",
      endpoints: {
        health: "/health",
        generate: "/api/agent/generate",
        verify: "/api/agent/verify",
      },
    });
  });

  return app;
}
