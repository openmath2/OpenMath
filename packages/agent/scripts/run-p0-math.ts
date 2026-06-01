/**
 * PHASE 1 / P0-C — tools/math-engine-client.ts 단독 실행.
 *
 * 시그니처는 실제 파일 그대로: createMathEngineClient({ baseUrl, timeoutMs?, retry? })
 * 또한 math-engine HTTP 자체가 살아있는지도 fetch 로 확인 (인용 schema 에 맞춰).
 *
 * 주의: 실제 math-engine 의 /solve schema 는 {equation, variable} 이지
 *      사용자가 적은 {expr, var} 가 아님.
 */

import { createMathEngineClient } from "../src/tools/math-engine-client.js";

const ME_URL = "http://localhost:8000";

async function rawProbe(path: string, body: unknown): Promise<string> {
  try {
    const res = await fetch(`${ME_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return `HTTP ${res.status} → ${JSON.stringify(json)}`;
  } catch (err) {
    return `FAIL: ${(err as Error).message}`;
  }
}

async function main() {
  console.log("=== P0-C: createMathEngineClient 단독 실행 ===\n");

  console.log("[1] client 객체 생성");
  try {
    const client = createMathEngineClient({ baseUrl: ME_URL });
    console.log("  ✅ client 생성");

    console.log("\n[2] client 메서드 호출");
    try {
      const s = await client.solve({ equation: "x**2 - 5*x + 6 = 0", variable: "x" });
      console.log(`  ✅ client.solve → ${JSON.stringify(s)}`);
    } catch (err) {
      console.log(`  ❌ client.solve THROW: ${(err as Error).message}`);
    }
  } catch (err) {
    console.log(`  ❌ createMathEngineClient THROW: ${(err as Error).message}`);
    console.log("     (참고: packages/agent/src/tools/math-engine-client.ts:73)");
  }

  console.log("\n[3] math-engine HTTP 자체 도달성 (raw fetch)");
  try {
    const r = await fetch(`${ME_URL}/health`);
    const j = await r.json();
    console.log(`  ✅ /health → HTTP ${r.status} ${JSON.stringify(j)}`);
  } catch (err) {
    console.log(`  ❌ /health 도달 불가: ${(err as Error).message}`);
    return;
  }

  console.log("\n[4] 5 SymPy 엔드포인트 raw fetch 검증");
  console.log(`  /solve         (x^2 - 5x + 6 = 0): ${await rawProbe("/solve", { equation: "x**2 - 5*x + 6 = 0", variable: "x" })}`);
  console.log(`  /verify        ((x+1)(x-1) == x^2-1): ${await rawProbe("/verify", { expr1: "(x+1)*(x-1)", expr2: "x**2 - 1" })}`);
  console.log(`  /simplify      ((x^2-1)/(x-1)): ${await rawProbe("/simplify", { expr: "(x**2 - 1)/(x - 1)" })}`);
  console.log(`  /differentiate (x^3 + 2x): ${await rawProbe("/differentiate", { expr: "x**3 + 2*x", variable: "x" })}`);
  console.log(`  /limit         (sin(x)/x at 0): ${await rawProbe("/limit", { expr: "sin(x)/x", variable: "x", point: "0" })}`);
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
