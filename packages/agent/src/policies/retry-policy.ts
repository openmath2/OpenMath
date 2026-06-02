/** Retry policy — D-5 inner loop. Verification attempt_count ≤ 3 (I-V5, Q-5 잠정). */

import type { Verification } from "../schemas/index.js";

export interface RetryDecision {
  shouldRetry: boolean;
  nextAttempt: number;
  refinementHint?: string;
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
        verification.overall !== "verified" && nextAttempt <= opts.maxAttempts;
      return {
        shouldRetry,
        nextAttempt,
        refinementHint: firstFailureMessage(verification),
      };
    },
  };
}

function firstFailureMessage(verification: Verification): string | undefined {
  if (verification.failure_reason !== undefined) {
    return verification.failure_reason.user_message_ko;
  }
  const failed = verification.gates.find((gate) => gate.status === "failed");
  return failed?.failure_detail?.message;
}
