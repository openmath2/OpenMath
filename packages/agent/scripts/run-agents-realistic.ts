/**
 * PHASE 2 RE-RUN — 4 agent 통합 dummy 입력 테스트 (factory 단계까지).
 *
 * OM-98 (Generator dummy schema 정합):
 *   - 이전 dummy 는 camelCase + 임의 wrapper 로 작성됐는데, agent 내부 schema
 *     (IntentSchema, RagResultSchema) 는 snake_case + 다른 구조. factory 가 stub
 *     throw 이라 mismatch 가 .generate() 까지 닿지 못해 silent.
 *   - 본 갱신은 Generator dummy 를 실 schema (IntentSchema + RagResult[]) 정합으로
 *     교체 + safeParse 가드 추가. critic / refiner 의 schema 외 필드도 함께 정리.
 *
 * factory 자체는 여전히 stub → throw 결과는 동일. 차이는: stub 이 풀린 뒤
 * (T-009 Generator 구현 시) dummy 가 그대로 .generate() 에 통과 가능.
 */

import { createConstraintCriticAgent } from "../src/agents/constraint-critic-agent.js";
import { createGeneratorAgent } from "../src/agents/generator-agent.js";
import { createRefinerAgent } from "../src/agents/refiner-agent.js";
import { createSolverAgent } from "../src/agents/solver-agent.js";
import { IntentSchema, type Intent } from "../src/schemas/intent.schema.js";
import {
  RagResultSchema,
  type RagResult,
} from "../src/schemas/rag.schema.js";
import { z } from "zod";

interface Stage { stage: "factory" | "method"; status: "ok" | "throw"; line: string; message?: string }
const log: Stage[] = [];

async function tryStage(stage: Stage["stage"], line: string, fn: () => Promise<unknown> | unknown): Promise<unknown | null> {
  try {
    const r = await fn();
    log.push({ stage, status: "ok", line });
    return r;
  } catch (err) {
    log.push({ stage, status: "throw", line, message: (err as Error).message });
    return null;
  }
}

/* OM-98: Generator dummy — IntentSchema + RagResult[] 정합. */

const dummyIntent: Intent = {
  objective_code: "9수04-14",
  objective_description: "이차방정식의 해를 구할 수 있다",
  evaluation_dimensions: [
    { id: "dim-001", description: "절차적 풀이", must_preserve: true },
    { id: "dim-002", description: "개념 이해", must_preserve: false },
  ],
  required_techniques: ["인수분해"],
  forbidden_techniques: [],
  surface_constraints: {
    difficulty: "medium",
    problem_type: "objective",
  },
};

const dummyRag: RagResult[] = [
  {
    item_id: "ref-001",
    similarity: 0.8,
    match_reason: "structural",
    problem: {
      item_id: "ref-001",
      source_dataset: "110",
      split: "train",
      source_label_type: "manual",
      school_level: "middle",
      grade: 3,
      semester: 1,
      topic_code: "9수04-14",
      topic_name: "이차방정식",
      achievement_standard: null,
      question_text: "x^2-5x+6=0 \\;\\text{을 풀어라}",
      answer_text: "x=2 \\;\\text{또는}\\; x=3",
      explanation_text: "(x-2)(x-3)=0 인수분해",
      choice_blocks: null,
      problem_type_norm: "objective",
      difficulty_norm: "medium",
      question_image_relpath: null,
      answer_image_relpath: null,
      question_json_relpath: null,
      answer_json_relpath: null,
    },
  },
];

async function main() {
  console.log("=== PHASE 2 RE-RUN: 4 agent factory 통합 테스트 ===\n");

  /* OM-98: safeParse 가드 — Generator dummy 가 실 schema 통과하는지 검증. */
  const intentParsed = IntentSchema.safeParse(dummyIntent);
  if (!intentParsed.success) {
    console.error("❌ intent dummy 타입 오류:", intentParsed.error.format());
    process.exit(1);
  }
  console.log("✅ intent dummy IntentSchema 통과");

  const ragParsed = z.array(RagResultSchema).safeParse(dummyRag);
  if (!ragParsed.success) {
    console.error("❌ rag dummy 타입 오류:", ragParsed.error.format());
    process.exit(1);
  }
  console.log("✅ rag dummy RagResult[] 통과\n");

  // ---------- Generator ----------
  console.log("[Agent 1] createGeneratorAgent — schema-correct dummy");
  const userDummyGenerator = {
    intent: intentParsed.data,
    refs: ragParsed.data,
    constraints: { difficulty: "medium" as const },
  };
  console.log(`  → input: ${JSON.stringify(userDummyGenerator).slice(0, 120)}…`);
  const gen = await tryStage("factory", "src/agents/generator-agent.ts:42", () =>
    createGeneratorAgent({ model: { provider: "stub" } as never, promptId: "problem-generator" }),
  );
  if (gen) {
    await tryStage("method", "agent.generate()", async () =>
      (gen as { generate: (i: unknown) => Promise<unknown> }).generate(userDummyGenerator),
    );
  } else {
    console.log("  → factory 가 throw 라 .generate() 호출 안 함");
  }

  // ---------- Constraint Critic ----------
  console.log("\n[Agent 2] createConstraintCriticAgent — 사용자 dummy 입력 그대로");
  const userDummyCritic = {
    draft: { statement: "x^2-7x+12=0을 풀어라", answer: "x=3 또는 x=4", solution: "인수분해" },
    constraints: { difficulty: "medium" as const },
  };
  console.log(`  → input: ${JSON.stringify(userDummyCritic).slice(0, 120)}…`);
  const crit = await tryStage("factory", "src/agents/constraint-critic-agent.ts:31", () =>
    createConstraintCriticAgent({ model: { provider: "stub" } as never, promptId: "constraint-critic" }),
  );
  if (crit) {
    await tryStage("method", "agent.critique()", async () =>
      (crit as { critique: (i: unknown) => Promise<unknown> }).critique(userDummyCritic),
    );
  } else {
    console.log("  → factory 가 throw 라 .critique() 호출 안 함");
  }

  // ---------- Refiner ----------
  console.log("\n[Agent 3] createRefinerAgent — 사용자 dummy 입력 그대로");
  const userDummyRefiner = {
    draft: { statement: "x^2-7x+12=0을 풀어라", answer: "x=3 또는 x=4" },
    violations: ["정수해 조건 위반: x=5/2"],
  };
  console.log(`  → input: ${JSON.stringify(userDummyRefiner).slice(0, 120)}…`);
  const ref = await tryStage("factory", "src/agents/refiner-agent.ts:23", () =>
    createRefinerAgent({ model: { provider: "stub" } as never, promptId: "refiner" }),
  );
  if (ref) {
    await tryStage("method", "agent.refine()", async () =>
      (ref as { refine: (i: unknown) => Promise<unknown> }).refine(userDummyRefiner),
    );
  } else {
    console.log("  → factory 가 throw 라 .refine() 호출 안 함");
  }

  // ---------- Solver ----------
  console.log("\n[Agent 4] createSolverAgent — OM-99 의 단독 스크립트 (run-agent-solver.ts) 참조");
  const slv = await tryStage("factory", "src/agents/solver-agent.ts:24", () =>
    createSolverAgent({ model: { provider: "stub" } as never, promptId: "independent-solver" }),
  );
  if (slv) {
    /* OM-99 의 schema-correct dummy 를 별도 스크립트에서 검증함. 여기선 factory 만 시도. */
    console.log("  → factory 가 OK 이면 별도 OM-99 스크립트에서 .solve() 검증");
  } else {
    console.log("  → factory 가 throw 라 .solve() 호출 안 함 (OM-99 스크립트도 마찬가지)");
  }

  console.log("\n=== 단계별 로그 ===");
  for (const s of log) {
    const tag = s.status === "ok" ? "✅ OK   " : "❌ THROW";
    console.log(`  ${tag} ${s.stage.padEnd(8)} ${s.line}${s.message ? `\n           → ${s.message}` : ""}`);
  }

  console.log("\n=== 결론 ===");
  const factoryThrows = log.filter((s) => s.stage === "factory" && s.status === "throw").length;
  const methodCalls = log.filter((s) => s.stage === "method").length;
  console.log(`  factory THROW: ${factoryThrows}/4`);
  console.log(`  .method() 호출 도달: ${methodCalls}/4`);
  console.log("  → 4 factory 모두 stub. T-009/52 구현 후 method 단계 dummy 검증 가능.");
  console.log("     OM-98 의 Generator dummy 는 이미 schema-correct 라 stub 풀리면 즉시 통과 예상.");
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
