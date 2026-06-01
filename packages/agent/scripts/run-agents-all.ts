/**
 * PHASE 2 — P1 Agent 4개 단독 호출.
 *
 * 모든 agent factory 시그니처는 동일: createXxxAgent({ model, promptId })
 * stub 이라 더미 입력 ({} or 최소 객체) 으로 호출 → 어느 줄에서 throw 되는지 정확히 기록.
 */

import { createConstraintCriticAgent } from "../src/agents/constraint-critic-agent.js";
import { createGeneratorAgent } from "../src/agents/generator-agent.js";
import { createRefinerAgent } from "../src/agents/refiner-agent.js";
import { createSolverAgent } from "../src/agents/solver-agent.js";

interface Result { name: string; line: string; status: "ok" | "throw"; message?: string }
const results: Result[] = [];

function probe<T>(name: string, line: string, fn: () => T): T | null {
  try {
    const r = fn();
    results.push({ name, line, status: "ok" });
    return r;
  } catch (err) {
    const e = err as Error;
    results.push({ name, line, status: "throw", message: e.message });
    return null;
  }
}

async function main() {
  console.log("=== PHASE 2: 4 agent factory 단독 호출 ===\n");

  // Generator
  console.log("[1] createGeneratorAgent");
  const gen = probe(
    "createGeneratorAgent",
    "src/agents/generator-agent.ts:32",
    () =>
      createGeneratorAgent({
        model: { provider: "stub" } as never,
        promptId: "problem-generator",
      }),
  );
  if (gen) console.log("  ✅ factory OK — agent 객체 생성됨"); else console.log("  ❌ factory THROW");

  // ConstraintCritic
  console.log("\n[2] createConstraintCriticAgent");
  const critic = probe(
    "createConstraintCriticAgent",
    "src/agents/constraint-critic-agent.ts:31",
    () =>
      createConstraintCriticAgent({
        model: { provider: "stub" } as never,
        promptId: "constraint-critic",
      }),
  );
  if (critic) console.log("  ✅ factory OK"); else console.log("  ❌ factory THROW");

  // Refiner
  console.log("\n[3] createRefinerAgent");
  const refiner = probe(
    "createRefinerAgent",
    "src/agents/refiner-agent.ts:23",
    () =>
      createRefinerAgent({
        model: { provider: "stub" } as never,
        promptId: "refiner",
      }),
  );
  if (refiner) console.log("  ✅ factory OK"); else console.log("  ❌ factory THROW");

  // Solver
  console.log("\n[4] createSolverAgent");
  const solver = probe(
    "createSolverAgent",
    "src/agents/solver-agent.ts:24",
    () =>
      createSolverAgent({
        model: { provider: "stub" } as never,
        promptId: "independent-solver",
      }),
  );
  if (solver) console.log("  ✅ factory OK"); else console.log("  ❌ factory THROW");

  console.log("\n=== 요약 ===");
  for (const r of results) {
    const tag = r.status === "ok" ? "✅ OK    " : "❌ THROW ";
    console.log(`  ${tag} ${r.name.padEnd(35)} ${r.line}${r.message ? `\n           → ${r.message}` : ""}`);
  }
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
