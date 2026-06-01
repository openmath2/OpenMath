/**
 * PHASE 5 — 불변식 I-V1 ~ I-V5 동작 검증.
 *
 * schemas/verification.schema.ts 의:
 *  - VerificationSchema (Zod) — I-V1 (gates.length === 6) 강제
 *  - assertVerificationInvariants (runtime guard) — I-V2/I-V3/I-V4/I-V5
 *
 * 각 위반 케이스를 만들어서 던지는지 / 통과시키는지 확인.
 */

import {
  VerificationSchema,
  assertVerificationInvariants,
} from "../src/schemas/verification.schema.js";

const UUID = "00000000-0000-0000-0000-000000000000";
const baseGates = (
  ["rag", "intent", "generate", "sympy_verify", "re_solve", "objective_map"] as const
).map((step) => ({ step, status: "passed" as const, duration_ms: 100 }));

interface Result { name: string; expect: string; status: "pass" | "fail"; detail?: string }
const results: Result[] = [];

function expectZodReject(name: string, expect: string, value: unknown): void {
  const parsed = VerificationSchema.safeParse(value);
  if (parsed.success) {
    results.push({ name, expect, status: "fail", detail: "Zod 가 통과시킴 (위반 미검출)" });
  } else {
    results.push({ name, expect, status: "pass", detail: parsed.error.issues[0]?.message });
  }
}

function expectAssertThrow(name: string, expect: string, value: Parameters<typeof assertVerificationInvariants>[0]): void {
  try {
    assertVerificationInvariants(value);
    results.push({ name, expect, status: "fail", detail: "assert 가 통과시킴 (위반 미검출)" });
  } catch (err) {
    results.push({ name, expect, status: "pass", detail: (err as Error).message });
  }
}

function expectAssertPass(name: string, expect: string, value: Parameters<typeof assertVerificationInvariants>[0]): void {
  try {
    assertVerificationInvariants(value);
    results.push({ name, expect, status: "pass", detail: "통과 (예상대로)" });
  } catch (err) {
    results.push({ name, expect, status: "fail", detail: `예외 발생: ${(err as Error).message}` });
  }
}

async function main() {
  console.log("=== PHASE 5: 5 불변식 동작 검증 ===\n");

  // I-V1: gates 가 정확히 6개가 아니면 Zod 가 reject
  console.log("[I-V1] gates.length !== 6 → Zod reject 기대");
  expectZodReject(
    "I-V1 (gates=5)",
    "Zod reject",
    { candidate_id: UUID, overall: "verified", gates: baseGates.slice(0, 5), attempt_count: 1 },
  );

  // I-V2: overall=verified 인데 sympy_verify=failed → assertVerificationInvariants throw
  console.log("[I-V2/I-V3] sympy_verify=failed 인데 overall=verified → assert throw 기대");
  expectAssertThrow(
    "I-V2/I-V3 (sympy_failed + overall=verified)",
    "assert throw with I-V2 또는 I-V3 메시지",
    {
      candidate_id: UUID,
      overall: "verified",
      gates: baseGates.map((g) => (g.step === "sympy_verify" ? { ...g, status: "failed" as const } : g)),
      attempt_count: 1,
    },
  );

  // I-V4: warning 은 sympy_passed AND re_solve=failed 일 때만 — 반대 조건이면 throw
  console.log("[I-V4-A] warning 이지만 re_solve=passed → throw 기대");
  expectAssertThrow(
    "I-V4 (warning without re_solve failed)",
    "assert throw with I-V4 메시지",
    {
      candidate_id: UUID,
      overall: "warning",
      gates: baseGates, // 모두 passed (re_solve 도 passed)
      attempt_count: 1,
    },
  );

  console.log("[I-V4-B] warning + sympy=passed + re_solve=failed → 통과 기대");
  expectAssertPass(
    "I-V4 (정상 warning)",
    "통과",
    {
      candidate_id: UUID,
      overall: "warning",
      gates: baseGates.map((g) => (g.step === "re_solve" ? { ...g, status: "failed" as const } : g)),
      attempt_count: 1,
    },
  );

  // I-V5: attempt_count > 3 이면 overall=rejected 가 아닌 한 throw
  console.log("[I-V5] attempt_count=4 + overall=verified → throw 기대");
  expectAssertThrow(
    "I-V5 (attempt > 3 + verified)",
    "assert throw with I-V5 메시지",
    {
      candidate_id: UUID,
      overall: "verified",
      gates: baseGates,
      attempt_count: 4,
    },
  );

  console.log("[I-V5-B] attempt_count=4 + overall=rejected → 통과 기대");
  expectAssertPass(
    "I-V5 (정상 rejected after 4)",
    "통과",
    {
      candidate_id: UUID,
      overall: "rejected",
      gates: baseGates.map((g) => (g.step === "sympy_verify" ? { ...g, status: "failed" as const } : g)),
      attempt_count: 4,
    },
  );

  // 정상 케이스 — 모두 passed
  console.log("[정상] 모두 passed + verified + attempt=1 → 통과 기대");
  expectAssertPass(
    "정상 verified",
    "통과",
    {
      candidate_id: UUID,
      overall: "verified",
      gates: baseGates,
      attempt_count: 1,
    },
  );

  console.log("\n=== 요약 ===");
  for (const r of results) {
    const tag = r.status === "pass" ? "✅ EXPECTED  " : "❌ MISMATCH  ";
    console.log(`  ${tag} ${r.name.padEnd(45)} (${r.expect})`);
    if (r.detail) console.log(`     → ${r.detail}`);
  }
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
