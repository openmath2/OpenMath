/** Step 4: SymPy arithmetic verification. Deterministic (D-1, D-5). math-engine HTTP call. */

import type { GateResult, GeneratedProblem } from "../schemas/index.js";
import { withTimeout } from "../policies/timeout-policy.js";
import type { MathEngineClient } from "../tools/math-engine-client.js";

export interface SympyVerificationDeps {
  mathEngine: MathEngineClient;
  perStepTimeoutMs?: number;
}

export interface SympyVerificationInput {
  candidate: GeneratedProblem;
}

export interface SympyVerificationOutput {
  gate: GateResult;
}

export async function verifyWithSympy(
  deps: SympyVerificationDeps,
  input: SympyVerificationInput,
): Promise<SympyVerificationOutput> {
  const started = Date.now();
  try {
    const passed = await withTimeout(
      () => verifyCandidate(deps.mathEngine, input.candidate),
      { ms: deps.perStepTimeoutMs ?? 30_000, label: "sympy_verify" },
    );
    return {
      gate: {
        step: "sympy_verify",
        status: passed ? "passed" : "failed",
        duration_ms: Date.now() - started,
        evidence: { engine: "sympy" },
        failure_detail: passed
          ? undefined
          : {
              code: "sympy_solution_mismatch",
              message: "SymPy solution did not match the expected answer",
            },
      },
    };
  } catch (err) {
    return {
      gate: {
        step: "sympy_verify",
        status: "failed",
        duration_ms: Date.now() - started,
        evidence: { engine: "sympy" },
        failure_detail: {
          code: "sympy_error",
          message: err instanceof Error ? err.message : String(err),
        },
      },
    };
  }
}

async function verifyCandidate(
  mathEngine: MathEngineClient,
  candidate: GeneratedProblem,
): Promise<boolean> {
  if (!candidate.question_text.includes("=")) {
    throw new Error("SymPy verification supports equation candidates only");
  }

  const solved = await mathEngine.solve({ equation: candidate.question_text });
  if (solved.solutions.length === 0) {
    throw new Error("SymPy returned no solutions");
  }

  const expected = parseExpectedSolutions(candidate.expected_answer);
  if (expected.length === 0) {
    throw new Error("Expected answer contains no parseable solutions");
  }

  const actualCanonical = await canonicalizeAll(mathEngine, solved.solutions);
  const expectedCanonical = await canonicalizeAll(mathEngine, expected);
  return sameSet(actualCanonical, expectedCanonical);
}

function parseExpectedSolutions(answer: string): string[] {
  return answer
    .split(/[,;]|또는|or/)
    .map((part) => part.trim())
    .map((part) => part.replace(/^[a-zA-Z]\s*=\s*/, ""))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

async function canonicalizeAll(
  mathEngine: MathEngineClient,
  expressions: string[],
): Promise<string[]> {
  const canonical = await Promise.all(
    expressions.map(async (expr) => {
      const result = await mathEngine.simplify({ expr });
      return result.simplified.replace(/\s+/g, "");
    }),
  );
  return canonical.sort();
}

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}
