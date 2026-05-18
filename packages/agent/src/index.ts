/** Service entrypoint. Wiring of deps -> createApp is the only un-implemented part of scaffolding. */

import { loadEnv } from "./config/index.js";

export async function main(): Promise<void> {
  const env = loadEnv();
  console.log(
    `[openmath/agent] Boot pending. Port ${env.PORT}, math-engine ${env.MATH_ENGINE_URL}. ` +
      `See docs/specs/architecture.md D-3~D-8 + src/{tools,agents,steps,workflows}/*.`,
  );
  throw new Error("main: dependency wiring not implemented yet.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export type { Env } from "./config/index.js";
export * from "./schemas/index.js";
