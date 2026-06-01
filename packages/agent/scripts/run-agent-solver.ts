/**
 * OM-99: Solver agent 의 dummy 입력 타입 검증.
 *
 * 이전 [run-agents-realistic.ts](./run-agents-realistic.ts) 의 solver dummy 는
 * `{ problem: { statement: "..." } }` 였음 — agent 의 `SolverAgent.solve` 시그니처
 * (`(candidate: GeneratedProblem) => Promise<SolveAttempt>`) 와 형태가 완전히 다름.
 *
 * 본 스크립트는:
 *  1. GeneratedProblemSchema 전 필드를 충족하는 dummy 정의
 *  2. safeParse 로 schema 통과 검증
 *  3. (optional) createSolverAgent stub 호출 시도 — factory 가 throw 라 도달 X (정상)
 *
 * 실행: `cd packages/agent && npx tsx scripts/run-agent-solver.ts`
 */

import { createSolverAgent } from "../src/agents/solver-agent.js";
import {
  GeneratedProblemSchema,
  type GeneratedProblem,
} from "../src/schemas/generated-problem.schema.js";

const dummy: GeneratedProblem = {
  candidate_id: crypto.randomUUID(),
  mode: "structural",
  question_text: "x^2 - 5x + 6 = 0 \\;\\text{을 풀어라}",
  expected_answer: "x = 2 \\;\\text{또는}\\; x = 3",
  proposed_solution_trace: "인수분해: (x-2)(x-3) = 0 → x = 2, 3",
  source_refs: ["ref-001"],
  inferred_intent: {
    objective_code: "9수04-14",
    objective_description: "이차방정식의 해를 구할 수 있다",
    evaluation_dimensions: [
      {
        id: "A",
        description: "인수분해 또는 근의 공식 사용",
        must_preserve: true,
      },
    ],
    required_techniques: ["인수분해"],
    forbidden_techniques: [],
    surface_constraints: {
      difficulty: "medium",
      problem_type: "objective",
    },
  },
  generation_metadata: {
    model: "gpt-4o",
    temperature: 0.7,
    prompt_id: "problem-generator",
    prompt_version: "0.1.0",
    attempt: 0,
    generated_at: new Date().toISOString(),
    refined_by: [],
  },
};

const parsed = GeneratedProblemSchema.safeParse(dummy);
if (!parsed.success) {
  console.error("❌ dummy 타입 오류:", parsed.error.format());
  process.exit(1);
}
console.log("✅ dummy GeneratedProblemSchema 통과");

/* createSolverAgent 는 현재 stub (AGENTS.md §9). factory 호출 시점에 throw 예상.
 * 본 스크립트의 1차 목적은 schema 정합성 검증이라 factory throw 는 정상 결과로 간주. */
try {
  const solver = createSolverAgent({
    model: undefined as unknown as Parameters<typeof createSolverAgent>[0]["model"],
    promptId: "independent-solver",
  });
  await solver.solve(parsed.data);
  console.log("✅ solver.solve 호출 성공 (factory 가 구현됐다는 뜻)");
} catch (err) {
  console.log(
    `⚠ solver factory/solve 가 throw (현재 stub 이라 예상 동작): ${(err as Error).message}`,
  );
}
