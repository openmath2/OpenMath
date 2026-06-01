/** POST /api/verify/partial — 부분 재검증. 단발 JSON 응답 (SSE 아님).
 *
 *  6단계 중 4/6 (sympy_verify) + 5/6 (re_solve) 두 gate 만 재실행한다.
 *  사용처: 사용자가 후보 문제를 살짝 수정해서 산술/독립재풀이만 다시 확인하고 싶을 때.
 *
 *  Full Verification 객체는 만들지 않는다 — gates(2개) + overall 만 반환.
 *  따라서 verification.schema.ts 의 I-V1~I-V5 invariant (6 gate 강제) 는 적용되지 않음.
 *  partial 응답이라는 점이 호출자 (FE) 에게 명확해야 한다.
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { SolverAgent } from "../../agents/index.js";
import {
  type GeneratedProblem,
  IntentSchema,
  type OverallVerdict,
} from "../../schemas/index.js";
import { independentResolve } from "../../steps/independent-resolve.js";
import { verifyWithSympy } from "../../steps/sympy-verification.js";
import type { MathEngineClient } from "../../tools/math-engine-client.js";

export interface VerifyPartialDeps {
  mathEngine: MathEngineClient;
  solver: SolverAgent;
}

/* candidate_id 는 GeneratedProblemSchema 와 동일하게 uuid 강제 — 외부에서 들어온 임의
 * 문자열이 후속 로직 (Verification.candidate_id) 과 호환되도록 한다.
 */
const VerifyPartialRequestSchema = z.object({
  candidate_id: z.string().uuid(),
  question_text: z.string().min(1),
  expected_answer: z.string().min(1),
  intent: IntentSchema,
});

export function createVerifyPartialRoute(deps: VerifyPartialDeps): Hono {
  const app = new Hono();

  app.post(
    "/api/verify/partial",
    zValidator("json", VerifyPartialRequestSchema),
    async (c) => {
      const body = c.req.valid("json");

      /* step 함수 시그니처가 GeneratedProblem 전체를 요구한다 (sympy_verify 와
       * re_solve 가 후보 객체 단위로 동작하도록 설계됨, D-5). 본 endpoint 는 4·5 gate
       * 만 다루므로 본 요청에 없는 필드들 (mode/source_refs/generation_metadata 등) 은
       * routing-time placeholder 로 채운다.
       *
       * 이 placeholder 들은 step 본문 로직에서 (question_text/expected_answer 외엔)
       * 참조되지 않는 것이 전제. 만약 step 내부에서 generation_metadata.model 등을
       * 읽기 시작하면 본 endpoint 의 응답에 합성된 가짜 값이 흘러갈 수 있으므로 주의.
       */
      const candidate: GeneratedProblem = {
        candidate_id: body.candidate_id,
        mode: "structural",
        question_text: body.question_text,
        expected_answer: body.expected_answer,
        proposed_solution_trace: "",
        source_refs: [],
        inferred_intent: body.intent,
        generation_metadata: {
          model: "partial-reverify",
          temperature: 0,
          prompt_id: "partial-reverify",
          prompt_version: "0.0.0",
          attempt: 0,
          generated_at: new Date().toISOString(),
        },
      };

      try {
        const sympy = await verifyWithSympy(
          { mathEngine: deps.mathEngine },
          { candidate },
        );
        const reSolve = await independentResolve(
          { solver: deps.solver, mathEngine: deps.mathEngine },
          { candidate, sympyGate: sympy.gate },
        );

        /* user spec:
         *  - 둘 다 passed              → "verified"
         *  - sympy passed + resolve !passed → "warning"
         *  - sympy !passed             → "rejected"
         * "skipped" 같은 비-passed 케이스는 spec 에 없어 보수적으로 처리한다
         * (sympy 가 passed 가 아니면 무조건 rejected).
         */
        const sympyPassed = sympy.gate.status === "passed";
        const resolvePassed = reSolve.gate.status === "passed";
        const overall: OverallVerdict = !sympyPassed
          ? "rejected"
          : resolvePassed
            ? "verified"
            : "warning";

        return c.json({ gates: [sympy.gate, reSolve.gate], overall }, 200);
      } catch (err) {
        return c.json(
          { error: err instanceof Error ? err.message : String(err) },
          500,
        );
      }
    },
  );

  return app;
}
