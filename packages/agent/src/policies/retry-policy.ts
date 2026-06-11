/** Retry policy — D-5 inner loop. Verification attempt_count ≤ 3 (I-V5, Q-5 잠정). */

import type { GateResult, Verification } from "../schemas/index.js";

export interface RetryDecision {
  shouldRetry: boolean;
  nextAttempt: number;
  refinementHint?: string;
  counterexample?: string;
}

export interface RetryPolicy {
  decide(verification: Verification): RetryDecision;
}

export interface BoundedRetryPolicyOptions {
  maxAttempts: number;
}

export function createBoundedRetryPolicy(
  opts: BoundedRetryPolicyOptions,
): RetryPolicy {
  if (!Number.isInteger(opts.maxAttempts) || opts.maxAttempts < 1) {
    throw new Error(`maxAttempts must be a positive integer (got ${opts.maxAttempts})`);
  }
  return {
    decide(verification) {
      const nextAttempt = verification.attempt_count + 1;
      const shouldRetry =
        nextAttempt <= opts.maxAttempts && isRetryableVerification(verification);
      return {
        shouldRetry,
        nextAttempt,
        refinementHint: refinementHintFor(verification),
        counterexample: counterexampleFor(verification),
      };
    },
  };
}

function isRetryableVerification(verification: Verification): boolean {
  if (verification.overall === "verified") return false;
  if (verification.gates.some((gate) => gate.step === "re_solve" && gate.status === "failed")) {
    return true;
  }
  if (verification.gates.some((gate) => gate.status === "failed")) return true;
  return verification.overall === "rejected";
}

function refinementHintFor(verification: Verification): string | undefined {
  const failed = verification.gates.find((gate) => gate.status === "failed");
  if (failed === undefined) return verification.failure_reason?.user_message_ko;
  return (
    gateSpecificHint(failed) ??
    verification.failure_reason?.user_message_ko ??
    failed.failure_detail?.message
  );
}

function gateSpecificHint(gate: GateResult): string | undefined {
  if (gate.step === "sympy_verify") return sympyHint(gate);
  if (gate.step === "re_solve") return reSolveHint(gate);
  if (gate.step === "objective_map") {
    return withFailureMessage(
      gate,
      "학습목표 매칭 실패: 보존 평가 차원과 금지 기법을 다시 확인하라",
    );
  }
  if (gate.step === "generate") {
    return withFailureMessage(
      gate,
      "생성 실패: JSON 형식, 문제 유형, 정답 필드를 지켜 다시 생성하라",
    );
  }
  if (gate.step === "intent") {
    return withFailureMessage(gate, "의도 추출 실패: 원문 학습목표와 평가 차원을 더 명확히 반영하라");
  }
  if (gate.step === "rag") {
    return withFailureMessage(gate, "참조 문제 검색 실패: 선택한 단원과 성취기준에 맞는 변형 기준을 다시 확인하라");
  }
  return gate.failure_detail?.message;
}

function sympyHint(gate: GateResult): string {
  const evidence = recordFrom(gate.evidence);
  const expected = stringField(evidence, [
    "expected_answer",
    "expectedAnswer",
    "expected",
  ]);
  const derived = stringField(evidence, [
    "sympy_answer",
    "sympyAnswer",
    "derived_answer",
    "derivedAnswer",
    "actual_answer",
    "actualAnswer",
    "engine_result",
    "engineResult",
  ]);
  if (expected !== undefined && derived !== undefined) {
    return `SymPy 검산 불일치: 기대답 ${expected}, 엔진 결과 ${derived} — 계수를 다시 검산하라`;
  }
  return withFailureMessage(
    gate,
    "SymPy 검산 실패: 문제 식과 expected_answer가 같은 해를 갖도록 계수와 정답을 다시 계산하라",
  );
}

function reSolveHint(gate: GateResult): string {
  const evidence = recordFrom(gate.evidence);
  const expected = stringField(evidence, ["expected_answer", "expectedAnswer", "expected"]);
  const derived = stringField(evidence, ["derived_answer", "derivedAnswer", "actual_answer", "actualAnswer"]);
  if (expected !== undefined && derived !== undefined) {
    return `독립 풀이 불일치: 기대답 ${expected}, 재풀이 결과 ${derived} — 풀이 추적과 정답을 다시 맞춰라`;
  }
  return withFailureMessage(gate, "독립 풀이 불일치: 풀이 추적과 정답이 일관되도록 다시 생성하라");
}

function withFailureMessage(gate: GateResult, action: string): string {
  const message = gate.failure_detail?.message;
  return message === undefined ? action : `${action}. 세부 원인: ${message}`;
}

function counterexampleFor(verification: Verification): string | undefined {
  const generateGate = verification.gates.find((gate) => gate.step === "generate");
  const evidence = recordFrom(generateGate?.evidence);
  const candidate = recordFrom(evidence?.candidate);
  const question =
    stringField(evidence, ["question_text", "questionText", "question"]) ??
    stringField(candidate, ["question_text", "questionText", "question"]);
  const answer =
    stringField(evidence, ["expected_answer", "expectedAnswer", "answer"]) ??
    stringField(candidate, ["expected_answer", "expectedAnswer", "answer"]);
  if (question === undefined || answer === undefined) return undefined;
  return [
    "이전 실패 후보(반복 금지):",
    `문제: ${question}`,
    `정답: ${answer}`,
  ].join("\n");
}

function recordFrom(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function stringField(
  record: Record<string, unknown> | undefined,
  keys: readonly string[],
): string | undefined {
  if (record === undefined) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}
