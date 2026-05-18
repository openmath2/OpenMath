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
  _opts: BoundedRetryPolicyOptions,
): RetryPolicy {
  throw new Error("createBoundedRetryPolicy: not implemented yet");
}
