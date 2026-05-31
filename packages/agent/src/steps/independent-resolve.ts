/** Step 5: Independent re-solve. ReSolveSpecialist (D-5). Compares against SymPy answer
 *  (D-1: LLM never judges, only produces a second opinion). */

import type { SolverAgent } from "../agents/index.js";
import type { GateResult, GeneratedProblem } from "../schemas/index.js";
import type { MathEngineClient } from "../tools/math-engine-client.js";
import { normalizeMathText } from "./sympy-verification.js";

export interface IndependentResolveDeps {
  solver: SolverAgent;
  mathEngine: MathEngineClient;
}

export interface IndependentResolveInput {
  candidate: GeneratedProblem;
  sympyGate: GateResult;
}

export interface IndependentResolveOutput {
  gate: GateResult;
}

export async function independentResolve(
  deps: IndependentResolveDeps,
  input: IndependentResolveInput,
): Promise<IndependentResolveOutput> {
  const started = Date.now();
  if (input.sympyGate.status === "skipped") {
    return {
      gate: {
        step: "re_solve",
        status: "skipped",
        duration_ms: Date.now() - started,
        evidence: { reason: "sympy_verify skipped" },
      },
    };
  }
  if (input.sympyGate.status === "failed") {
    return {
      gate: {
        step: "re_solve",
        status: "skipped",
        duration_ms: Date.now() - started,
        evidence: { reason: "sympy_verify failed" },
      },
    };
  }

  try {
    const attempt = await deps.solver.solve(input.candidate);
    const check = await deps.mathEngine.verify({
      expr1: normalizeMathText(attempt.derived_answer),
      expr2: normalizeMathText(input.candidate.expected_answer),
    });

    return {
      gate: {
        step: "re_solve",
        status: check.equivalent ? "passed" : "failed",
        duration_ms: Date.now() - started,
        evidence: { attempt, diff: check.diff },
        ...(check.equivalent
          ? {}
          : {
              failure_detail: {
                code: "independent_resolve_mismatch",
                message: "Independent solver answer differs from candidate answer.",
              },
            }),
      },
    };
  } catch (error) {
    return {
      gate: {
        step: "re_solve",
        status: "failed",
        duration_ms: Date.now() - started,
        failure_detail: {
          code: "independent_solver_error",
          message: error instanceof Error ? error.message : String(error),
        },
      },
    };
  }
}
