/**
 * PHASE 1 / P0-A — tools/llm-provider.ts 단독 실행.
 *
 * 기존 코드 수정 금지. .env 파일 없음 → process.env 를 inline 으로 설정.
 * 시그니처는 실제 파일 그대로: resolveLanguageModel(config: LlmProviderConfig)
 */

process.env.LLM_PROVIDER = "openai-compatible";
process.env.LLM_BASE_URL = "http://127.0.0.1:8317/v1";
process.env.LLM_API_KEY = "my-secret-key";

import { resolveLanguageModel } from "../src/tools/llm-provider.js";

async function main() {
  console.log("=== P0-A: resolveLanguageModel 단독 실행 ===\n");

  console.log("[1] env 확인");
  console.log(`  LLM_PROVIDER=${process.env.LLM_PROVIDER}`);
  console.log(`  LLM_BASE_URL=${process.env.LLM_BASE_URL}`);
  console.log(`  LLM_API_KEY=${process.env.LLM_API_KEY ? "(set)" : "(MISSING)"}`);

  console.log("\n[2] 모델 객체 생성 시도");
  let model;
  try {
    model = resolveLanguageModel({
      kind: "openai-compatible",
      modelId: "claude-haiku-4-5-20251001",
      baseUrl: process.env.LLM_BASE_URL,
      apiKey: process.env.LLM_API_KEY,
    });
    console.log(`  ✅ 생성됨: provider=${model.provider}, modelId=${model.modelId}`);
  } catch (err) {
    const e = err as Error;
    console.log(`  ❌ THROW at resolveLanguageModel`);
    console.log(`     message: ${e.message}`);
    console.log(`     (참고 — 파일:줄: packages/agent/src/tools/llm-provider.ts:24)`);
    return;
  }

  console.log("\n[3] 실제 LLM 호출 (1+1은?)");
  try {
    const { generateText } = await import("ai");
    const result = await generateText({
      model,
      prompt: "1+1은? 한 문장으로만 답해주세요.",
      maxTokens: 50,
    });
    console.log(`  ✅ 응답: ${result.text}`);
  } catch (err) {
    const e = err as Error;
    console.log(`  ❌ generateText 실패: ${e.message}`);
  }
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
