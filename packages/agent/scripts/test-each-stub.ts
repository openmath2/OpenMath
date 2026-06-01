/**
 * Agent 단독 검증 — 각 factory/step을 실제로 호출하여 어디서 throw 되는지 기록.
 * 의도적으로 try/catch로 감싸 모든 결과를 수집 (실패해도 다음 모듈로 진행).
 */

import { createMathEngineClient } from "../src/tools/math-engine-client.js";
import { resolveLanguageModel } from "../src/tools/llm-provider.js";
import { createFsPromptLoader } from "../src/tools/prompt-loader.js";
import { createFsStrategyLoader } from "../src/tools/schema-loader.js";
import { createGeneratorAgent } from "../src/agents/generator-agent.js";
import { createConstraintCriticAgent } from "../src/agents/constraint-critic-agent.js";
import { createRefinerAgent } from "../src/agents/refiner-agent.js";
import { createSolverAgent } from "../src/agents/solver-agent.js";
import { createAcceptancePolicy } from "../src/policies/acceptance-policy.js";
import { createBoundedRetryPolicy } from "../src/policies/retry-policy.js";
import { withTimeout } from "../src/policies/timeout-policy.js";
import { extractIntent } from "../src/steps/intent-extraction.js";
import { ragSearch } from "../src/steps/rag-search.js";
import { generateProblem } from "../src/steps/problem-generation.js";
import { verifyWithSympy } from "../src/steps/sympy-verification.js";
import { independentResolve } from "../src/steps/independent-resolve.js";
import { mapObjective } from "../src/steps/objective-mapping.js";
import { runVerificationWorkflow } from "../src/workflows/verification-workflow.js";
import { pipeProgressToSse } from "../src/server/sse/progress-stream.js";

type Result =
  | { name: string; status: "ok"; note?: string }
  | { name: string; status: "throws"; message: string }
  | { name: string; status: "async-throws"; message: string };

const results: Result[] = [];

function tryCall(name: string, fn: () => unknown): void {
  try {
    fn();
    results.push({ name, status: "ok" });
  } catch (e) {
    results.push({
      name,
      status: "throws",
      message: (e as Error).message,
    });
  }
}

async function tryAwait(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    results.push({ name, status: "ok" });
  } catch (e) {
    results.push({
      name,
      status: "async-throws",
      message: (e as Error).message,
    });
  }
}

async function main() {
  // Tool factories (sync)
  tryCall("tools/math-engine-client::createMathEngineClient", () =>
    createMathEngineClient({ baseUrl: "http://localhost:8000" }),
  );
  tryCall("tools/llm-provider::resolveLanguageModel", () =>
    resolveLanguageModel({ kind: "openai-compatible", modelId: "gpt-4o" }),
  );
  tryCall("tools/prompt-loader::createFsPromptLoader", () =>
    createFsPromptLoader({ promptsDir: "./prompts" }),
  );
  tryCall("tools/schema-loader::createFsStrategyLoader", () =>
    createFsStrategyLoader({ strategiesDir: "./data/achievement-standards" }),
  );

  // Agent factories (sync)
  const dummyModel = {} as never; // not implemented anyway
  tryCall("agents::createGeneratorAgent", () =>
    createGeneratorAgent({ model: dummyModel, promptId: "problem-generator" }),
  );
  tryCall("agents::createConstraintCriticAgent", () =>
    createConstraintCriticAgent({ model: dummyModel, promptId: "constraint-critic" }),
  );
  tryCall("agents::createRefinerAgent", () =>
    createRefinerAgent({ model: dummyModel, promptId: "refiner" }),
  );
  tryCall("agents::createSolverAgent", () =>
    createSolverAgent({ model: dummyModel, promptId: "independent-solver" }),
  );

  // Policies (sync)
  tryCall("policies::createAcceptancePolicy", () => createAcceptancePolicy());
  tryCall("policies::createBoundedRetryPolicy", () =>
    createBoundedRetryPolicy({ maxAttempts: 3 }),
  );
  await tryAwait("policies::withTimeout(noop)", async () =>
    withTimeout(async () => 42, { ms: 1000, label: "noop" }),
  );

  // Steps (async)
  const dummyDeps = {} as never;
  const dummyInput = {} as never;
  await tryAwait("steps::extractIntent", () => extractIntent(dummyDeps, dummyInput));
  await tryAwait("steps::ragSearch", () => ragSearch(dummyDeps, dummyInput));
  await tryAwait("steps::generateProblem", () => generateProblem(dummyDeps, dummyInput));
  await tryAwait("steps::verifyWithSympy", () => verifyWithSympy(dummyDeps, dummyInput));
  await tryAwait("steps::independentResolve", () =>
    independentResolve(dummyDeps, dummyInput),
  );
  await tryAwait("steps::mapObjective", () => mapObjective(dummyDeps, dummyInput));

  // Workflow (sync — returns AsyncGenerator but factory throws immediately per code)
  tryCall("workflows::runVerificationWorkflow", () => {
    const gen = runVerificationWorkflow(dummyDeps, dummyInput);
    return gen;
  });

  // SSE
  await tryAwait("server/sse::pipeProgressToSse", async () => {
    async function* empty() {
      // no yields
    }
    return pipeProgressToSse({} as never, empty() as never);
  });

  console.log("\n========== AGENT MODULE RUNTIME PROBE ==========\n");
  for (const r of results) {
    const tag =
      r.status === "ok" ? "✅ OK" : r.status === "throws" ? "🔴 SYNC THROW" : "🔴 ASYNC THROW";
    if (r.status === "ok") {
      console.log(`${tag}  ${r.name}`);
    } else {
      console.log(`${tag}  ${r.name}\n        → ${r.message}`);
    }
  }
  const okCount = results.filter((r) => r.status === "ok").length;
  console.log(`\n총 ${results.length}건 중 정상 ${okCount}건, 실패 ${results.length - okCount}건.`);
}

main().catch((err) => {
  console.error("HARNESS CRASH:", err);
  process.exit(1);
});
