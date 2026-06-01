/**
 * PHASE 3 — P1 Step 6개 단독 호출.
 *
 * 모든 step 시그니처: stepFn(deps, input) → Promise<output>
 * stub 이라 {} as never 더미로 호출 → 실제 throw 줄번호 + 메시지 정확히 기록.
 */

import { independentResolve } from "../src/steps/independent-resolve.js";
import { extractIntent } from "../src/steps/intent-extraction.js";
import { mapObjective } from "../src/steps/objective-mapping.js";
import { generateProblem } from "../src/steps/problem-generation.js";
import { ragSearch } from "../src/steps/rag-search.js";
import { verifyWithSympy } from "../src/steps/sympy-verification.js";

interface Result { name: string; line: string; status: "ok" | "throw"; message?: string }
const results: Result[] = [];

async function probe(name: string, line: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    results.push({ name, line, status: "ok" });
  } catch (err) {
    const e = err as Error;
    results.push({ name, line, status: "throw", message: e.message });
  }
}

async function main() {
  console.log("=== PHASE 3: 6 step 함수 단독 호출 ===\n");

  const dummyDeps = {} as never;
  const dummyInput = {} as never;

  console.log("[1] ragSearch  — RAG client wrapper");
  await probe("ragSearch", "src/steps/rag-search.ts:22", () => ragSearch(dummyDeps, dummyInput));

  console.log("[2] extractIntent  — LLM 호출");
  await probe("extractIntent", "src/steps/intent-extraction.ts:32", () => extractIntent(dummyDeps, dummyInput));

  console.log("[3] generateProblem  — Generator + Critic + Refiner");
  await probe("generateProblem", "src/steps/problem-generation.ts:41", () => generateProblem(dummyDeps, dummyInput));

  console.log("[4] verifyWithSympy  — math-engine wrapper");
  await probe("verifyWithSympy", "src/steps/sympy-verification.ts:22", () => verifyWithSympy(dummyDeps, dummyInput));

  console.log("[5] independentResolve  — Solver wrapper");
  await probe("independentResolve", "src/steps/independent-resolve.ts:26", () => independentResolve(dummyDeps, dummyInput));

  console.log("[6] mapObjective  — LLM 또는 결정론 매핑");
  await probe("mapObjective", "src/steps/objective-mapping.ts:31", () => mapObjective(dummyDeps, dummyInput));

  console.log("\n=== 요약 ===");
  for (const r of results) {
    const tag = r.status === "ok" ? "✅ OK    " : "❌ THROW ";
    console.log(`  ${tag} ${r.name.padEnd(25)} ${r.line}${r.message ? `\n           → ${r.message}` : ""}`);
  }
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
