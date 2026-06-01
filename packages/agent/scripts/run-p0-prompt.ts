/**
 * PHASE 1 / P0-B — tools/prompt-loader.ts 단독 실행.
 *
 * 시그니처는 실제 파일 그대로: createFsPromptLoader({ promptsDir, hotReload? })
 * 6개 프롬프트 파일 (constraint-critic, independent-solver, intent-extraction,
 * objective-mapper, problem-generator, refiner) 순차 로드.
 */

import { createFsPromptLoader } from "../src/tools/prompt-loader.js";

const PROMPTS = [
  "problem-generator",
  "constraint-critic",
  "refiner",
  "independent-solver",
  "intent-extraction",
  "objective-mapper",
];

async function main() {
  console.log("=== P0-B: createFsPromptLoader 단독 실행 ===\n");

  console.log("[1] loader 객체 생성");
  let loader;
  try {
    loader = createFsPromptLoader({ promptsDir: "./prompts" });
    console.log("  ✅ loader 생성");
  } catch (err) {
    const e = err as Error;
    console.log(`  ❌ THROW: ${e.message}`);
    console.log("     (참고: packages/agent/src/tools/prompt-loader.ts:42)");
    return;
  }

  console.log("\n[2] 6 프롬프트 순차 로드");
  for (const id of PROMPTS) {
    try {
      const p = await loader.load(id);
      console.log(`  ✅ ${id}  (model=${p.metadata.model}, temp=${p.metadata.temperature}, schema=${p.metadata.schema ?? "(none)"})`);
    } catch (err) {
      console.log(`  ❌ ${id}  — ${(err as Error).message}`);
    }
  }
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
