/** Step 4: SymPy arithmetic verification. Deterministic (D-1, D-5). math-engine HTTP call. */

import type { GateResult, GeneratedProblem } from "../schemas/index.js";
import type { MathEngineClient } from "../tools/math-engine-client.js";

export interface SympyVerificationDeps {
  mathEngine: MathEngineClient;
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
  const equation = extractEquation(input.candidate.question_text);
  if (equation === null) {
    return {
      gate: {
        step: "sympy_verify",
        status: "failed",
        duration_ms: Date.now() - started,
        failure_detail: {
          code: "equation_not_found",
          message: "Generated problem does not contain a verifiable equation.",
        },
      },
    };
  }

  try {
    const solved = await deps.mathEngine.solve({ equation });
    const expected = normalizeMathText(input.candidate.expected_answer);
    const equivalent = await Promise.all(
      solved.solutions.map((solution) =>
        deps.mathEngine.verify({ expr1: solution, expr2: expected }),
      ),
    );
    const passed = equivalent.some((result) => result.equivalent);

    return {
      gate: {
        step: "sympy_verify",
        status: passed ? "passed" : "failed",
        duration_ms: Date.now() - started,
        evidence: {
          equation,
          solutions: solved.solutions,
          expected_answer: expected,
        },
        ...(passed
          ? {}
          : {
              failure_detail: {
                code: "answer_mismatch",
                message: "Expected answer does not match math-engine solution.",
              },
            }),
      },
    };
  } catch (error) {
    return {
      gate: {
        step: "sympy_verify",
        status: "failed",
        duration_ms: Date.now() - started,
        failure_detail: {
          code: "math_engine_error",
          message: error instanceof Error ? error.message : String(error),
        },
      },
    };
  }
}

export function extractEquation(text: string): string | null {
  const normalized = normalizeMathText(text);
  const match = normalized.match(/[A-Za-z0-9+\-*/^().\s]+=[A-Za-z0-9+\-*/^().\s]+/);
  return match?.[0]?.trim() ?? null;
}

export function normalizeMathText(text: string): string {
  return text
    .replace(/\\\((.*?)\\\)/g, "$1")
    .replace(/\$(.*?)\$/g, "$1")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)")
    .replace(/\^\{([^{}]+)\}/g, "^($1)")
    .replace(/[{}]/g, "")
    .replace(/−/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}
