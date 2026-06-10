/**
 * Verification — 6단계 검증 결과.
 *
 * 도메인: `docs/specs/domain.md` §2.4.
 * 불변식 I-V1 ~ I-V5 참조.
 *
 * 사용처:
 * - workflows/verification-workflow.ts가 매 attempt마다 누적
 * - 사용자 UX (`s5-result.html`, `s5-partial-failure.html`)의 표시 데이터
 */

import { z } from "zod";

export const StepNameSchema = z.enum([
  "rag",
  "intent",
  "generate",
  "sympy_verify",
  "re_solve",
  "objective_map",
]);
export type StepName = z.infer<typeof StepNameSchema>;

export const GateStatusSchema = z.enum(["passed", "failed", "skipped", "unverified"]);
export type GateStatus = z.infer<typeof GateStatusSchema>;

export const GateResultSchema = z.object({
  step: StepNameSchema,
  status: GateStatusSchema,
  duration_ms: z.number().int().min(0),
  evidence: z.unknown().optional(), // step별 다름
  failure_detail: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type GateResult = z.infer<typeof GateResultSchema>;

/**
 * 사람 언어 실패 사유 (D-USER-6, `HANDOFF.md` §3.4).
 * 시스템 신호를 강사가 즉시 이해 가능한 표현으로 변환.
 */
export const HumanFailureCategorySchema = z.enum([
  "arithmetic_error",
  "multiple_solutions",
  "independent_resolve_mismatch",
  "learning_objective_mismatch",
  "structural_error",
]);
export type HumanFailureCategory = z.infer<typeof HumanFailureCategorySchema>;

export const HumanFailureReasonSchema = z.object({
  category: HumanFailureCategorySchema,
  user_message_ko: z.string().min(1),
});

export type HumanFailureReason = z.infer<typeof HumanFailureReasonSchema>;

export const OverallVerdictSchema = z.enum(["verified", "rejected", "warning"]);
export type OverallVerdict = z.infer<typeof OverallVerdictSchema>;

export const VerificationSchema = z.object({
  candidate_id: z.string().uuid(),
  overall: OverallVerdictSchema,
  gates: z.array(GateResultSchema).length(6), // I-V1
  failure_reason: HumanFailureReasonSchema.optional(),
  attempt_count: z.number().int().min(1),
});

export type Verification = z.infer<typeof VerificationSchema>;

/**
 * 도메인 불변식 I-V2, I-V3, I-V4, I-V5의 runtime guard.
 * Workflow가 Verification 객체를 emit하기 전 호출.
 */
export function assertVerificationInvariants(v: Verification): void {
  const byStep = new Map(v.gates.map((g) => [g.step, g]));

  const sympy = byStep.get("sympy_verify");
  const objMap = byStep.get("objective_map");
  const reSolve = byStep.get("re_solve");

  // I-V2: verified는 sympy + objective_map 둘 다 passed
  if (v.overall === "verified") {
    if (sympy?.status !== "passed") {
      throw new Error(
        `I-V2 violated: overall=verified requires sympy_verify=passed (got ${sympy?.status})`,
      );
    }
    if (objMap?.status !== "passed") {
      throw new Error(
        `I-V2 violated: overall=verified requires objective_map=passed (got ${objMap?.status})`,
      );
    }
  }

  // I-V3: sympy_verify failed면 verified 불가 (D-1 원칙)
  if (sympy?.status === "failed" && v.overall === "verified") {
    throw new Error(
      `I-V3 violated: sympy_verify failed but overall=verified (D-1: LLM은 정답 판단 X)`,
    );
  }

  // I-V4: warning은 re_solve mismatch 또는 non-decidable gate를 정직하게 노출할 때만
  if (v.overall === "warning") {
    const hardFailed = v.gates.some(
      (gate) => gate.status === "failed" && gate.step !== "re_solve",
    );
    if (hardFailed) {
      throw new Error(
        "I-V4 violated: warning cannot mask failed deterministic gates other than re_solve",
      );
    }
    const reSolveMismatchWarning =
      (sympy?.status === "passed" || sympy?.status === "unverified") &&
      reSolve?.status === "failed";
    const unverifiedGateWarning = v.gates.some((gate) => gate.status === "unverified");
    if (!reSolveMismatchWarning && !unverifiedGateWarning) {
      throw new Error(
        `I-V4 violated: warning requires re_solve mismatch or an unverified gate (sympy=${sympy?.status}, re_solve=${reSolve?.status})`,
      );
    }
  }

  // I-V5: attempt_count > 3은 강제 rejected
  if (v.attempt_count > 3 && v.overall !== "rejected") {
    throw new Error(
      `I-V5 violated: attempt_count=${v.attempt_count} > 3 must yield overall=rejected`,
    );
  }
}
