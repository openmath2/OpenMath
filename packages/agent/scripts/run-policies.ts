/**
 * PHASE 4 — P2 Policy 3개 단독 호출.
 */

import { createAcceptancePolicy } from "../src/policies/acceptance-policy.js";
import { createBoundedRetryPolicy } from "../src/policies/retry-policy.js";
import { withTimeout } from "../src/policies/timeout-policy.js";

interface Result { name: string; line: string; status: "ok" | "throw"; message?: string }
const results: Result[] = [];

function probeSync(name: string, line: string, fn: () => unknown): void {
  try {
    fn();
    results.push({ name, line, status: "ok" });
  } catch (err) {
    results.push({ name, line, status: "throw", message: (err as Error).message });
  }
}

async function probeAsync(name: string, line: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    results.push({ name, line, status: "ok" });
  } catch (err) {
    results.push({ name, line, status: "throw", message: (err as Error).message });
  }
}

async function main() {
  console.log("=== PHASE 4: 3 policy 단독 호출 ===\n");

  console.log("[1] createAcceptancePolicy");
  probeSync("createAcceptancePolicy", "src/policies/acceptance-policy.ts:10", () =>
    createAcceptancePolicy(),
  );

  console.log("[2] createBoundedRetryPolicy");
  probeSync("createBoundedRetryPolicy", "src/policies/retry-policy.ts:22", () =>
    createBoundedRetryPolicy({ maxAttempts: 3 }),
  );

  console.log("[3] withTimeout (1초 안에 끝나는 noop)");
  await probeAsync("withTimeout", "src/policies/timeout-policy.ts:12", () =>
    withTimeout(async () => 42, { ms: 1000, label: "noop" }),
  );

  console.log("\n=== 요약 ===");
  for (const r of results) {
    const tag = r.status === "ok" ? "✅ OK    " : "❌ THROW ";
    console.log(`  ${tag} ${r.name.padEnd(30)} ${r.line}${r.message ? `\n           → ${r.message}` : ""}`);
  }
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
