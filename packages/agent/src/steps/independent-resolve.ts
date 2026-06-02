/** Step 5: Independent re-solve. ReSolveSpecialist (D-5). Compares against SymPy answer
 *  (D-1: LLM never judges, only produces a second opinion). */

import type { SolverAgent } from "../agents/index.js";
import type { GateResult, GeneratedProblem, SolveAttempt } from "../schemas/index.js";
import type { MathEngineClient } from "../tools/math-engine-client.js";
import { withTimeout } from "../policies/timeout-policy.js";

export interface IndependentResolveDeps {
  solver: SolverAgent;
  mathEngine: MathEngineClient;
  perStepTimeoutMs?: number;
}

export interface IndependentResolveInput {
  candidate: GeneratedProblem;
  sympyGate: GateResult;
}

export interface IndependentResolveOutput {
  data: SolveAttempt;
  gate: GateResult;
}

export async function independentResolve(
  deps: IndependentResolveDeps,
  input: IndependentResolveInput,
): Promise<IndependentResolveOutput> {
  const started = Date.now();
  try {
    const attempt = await withTimeout(
      () => deps.solver.solve(input.candidate),
      { ms: deps.perStepTimeoutMs ?? 30_000, label: "re_solve" },
    );
    const matches = await sameAnswer(deps.mathEngine, input.candidate.expected_answer, attempt.derived_answer);
    return {
      data: attempt,
      gate: {
        step: "re_solve",
        status: matches ? "passed" : "failed",
        duration_ms: Date.now() - started,
        evidence: {
          confidence: attempt.confidence,
          derived_answer: attempt.derived_answer,
          expected_answer: input.candidate.expected_answer,
          sympy_status: input.sympyGate.status,
        },
        failure_detail: matches
          ? undefined
          : {
              code: "independent_resolve_mismatch",
              message: "Independent solver answer differs from the expected SymPy-normalized answer",
            },
      },
    };
  } catch (err) {
    return {
      data: {
        derived_answer: "",
        trace: "Independent resolve failed before producing a trace.",
        confidence: "low",
      },
      gate: {
        step: "re_solve",
        status: "failed",
        duration_ms: Date.now() - started,
        failure_detail: {
          code: "independent_resolve_error",
          message: err instanceof Error ? err.message : String(err),
        },
      },
    };
  }
}

async function sameAnswer(
  mathEngine: MathEngineClient,
  expectedAnswer: string,
  derivedAnswer: string,
): Promise<boolean> {
  const expected = parseAnswers(expectedAnswer);
  const derived = parseAnswers(derivedAnswer);
  if (expected.length === 0 || derived.length === 0) return false;
  const expectedCanonical = await canonicalizeAll(mathEngine, expected);
  const derivedCanonical = await canonicalizeAll(mathEngine, derived);
  if (expectedCanonical.length !== derivedCanonical.length) return false;
  return expectedCanonical.every((value, index) => value === derivedCanonical[index]);
}

function parseAnswers(answer: string): string[] {
  return answer
    .split(/[,;]|또는|or/)
    .map((part) => part.trim())
    .map((part) => part.replace(/^[a-zA-Z]\s*=\s*/, ""))
    .filter((part) => part.length > 0);
}

async function canonicalizeAll(mathEngine: MathEngineClient, answers: string[]): Promise<string[]> {
  const canonical = await Promise.all(
    answers.map(async (answer) => {
      const result = await mathEngine.simplify({ expr: answer });
      return result.simplified.replace(/\s+/g, "");
    }),
  );
  return canonical.sort();
}
