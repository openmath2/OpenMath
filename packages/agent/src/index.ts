import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import { initializeLLMClient } from "./config/llm.js";

initializeLLMClient();

const app = createApp();
const port = Number(process.env.PORT) || 3000;

console.log(`OpenMath Agent running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
