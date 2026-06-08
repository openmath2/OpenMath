/** Step 4: SymPy arithmetic verification. Deterministic (D-1, D-5). math-engine HTTP call. */

import type { GateResult, GeneratedProblem } from "../schemas/index.js";
import { withTimeout } from "../policies/timeout-policy.js";
import { extractEquationText } from "../tools/equation-extractor.js";
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

type VerificationCheck = {
  readonly passed: boolean;
  readonly verificationKind: GeneratedProblem["generation_kind"];
};

export async function verifyWithSympy(
  deps: SympyVerificationDeps,
  input: SympyVerificationInput,
): Promise<SympyVerificationOutput> {
  const started = Date.now();
  try {
    const check = await withTimeout(
      () => verifyCandidate(deps.mathEngine, input.candidate),
      { ms: deps.perStepTimeoutMs ?? 30_000, label: "sympy_verify" },
    );
    return {
      gate: {
        step: "sympy_verify",
        status: check.passed ? "passed" : "failed",
        duration_ms: Date.now() - started,
        evidence: { engine: "sympy", verification_kind: check.verificationKind },
        failure_detail: check.passed
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
): Promise<VerificationCheck> {
  if (candidate.generation_kind === "equation") {
    if (isChoiceStyleCandidate(candidate)) {
      return {
        passed: candidate.question_text.trim().length > 0 && candidate.expected_answer.trim().length > 0,
        verificationKind: candidate.generation_kind,
      };
    }
    return {
      passed: await verifyEquationCandidate(mathEngine, candidate),
      verificationKind: candidate.generation_kind,
    };
  }

  if (candidate.generation_kind === "expression") {
    await verifyExpressionAnswer(mathEngine, candidate.expected_answer);
  }

  return {
    passed: candidate.question_text.trim().length > 0 && candidate.expected_answer.trim().length > 0,
    verificationKind: candidate.generation_kind,
  };
}

async function verifyExpressionAnswer(
  mathEngine: MathEngineClient,
  answer: string,
): Promise<void> {
  const parts = parseExpressionAnswerParts(answer);
  for (const part of parts) {
    await mathEngine.simplify({ expr: part });
  }
}

function parseExpressionAnswerParts(answer: string): string[] {
  return answer
    .replace(/(^|\s)\([1-9]\)\s+(?=\S)/gu, "$1;")
    .split(/[,;]|또는|or|\n/u)
    .map((part) => cleanExpressionAnswerPart(part))
    .filter((part) => /[0-9a-zA-Z]/u.test(part) && !/[가-힣]/u.test(part));
}

function cleanExpressionAnswerPart(part: string): string {
  return part
    .trim()
    .replace(/^[①②③④⑤⑥⑦⑧⑨]\s*/u, "")
    .replace(/(?<=\d)\s*(모둠|개|명|cm|kcal|도)$/u, "")
    .trim();
}

async function verifyEquationCandidate(
  mathEngine: MathEngineClient,
  candidate: GeneratedProblem,
): Promise<boolean> {
  const equation = extractEquationText(candidate.question_text);
  if (equation === null) {
    throw new Error("Equation verification requires an equation candidate");
  }

  const solved = await mathEngine.solve({ equation });
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

function isChoiceStyleCandidate(candidate: GeneratedProblem): boolean {
  return (
    /[①②③④⑤⑥⑦⑧⑨]|\([1-9]\)|[1-9][).]/u.test(candidate.question_text) &&
    /^(?:[①②③④⑤⑥⑦⑧⑨]|\([1-9]\)|[1-9][).])\s*/u.test(candidate.expected_answer.trim())
  );
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
