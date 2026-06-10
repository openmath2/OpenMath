/** Step 4: SymPy arithmetic verification. Deterministic (D-1, D-5). math-engine HTTP call. */

import type { GateResult, GeneratedProblem } from "../schemas/index.js";
import { withTimeout } from "../policies/timeout-policy.js";
import {
  choiceIndexFromAnswer,
  choiceOptionsFromExpectedChoices,
  decideAnswerEquivalence,
  decideAnswerMatchesSolutions,
  extractChoiceOptions,
  stripChoicePrefix,
  type AnswerEquivalenceDecision,
  type ChoiceOption,
} from "../tools/answer-equivalence.js";
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

type SympyCheckStatus = "passed" | "failed" | "unverified";

type VerificationCheck = {
  readonly status: SympyCheckStatus;
  readonly verificationKind: GeneratedProblem["generation_kind"];
  readonly expectedAnswer?: string;
  readonly sympyAnswer?: string;
  readonly reason?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly evidence?: Record<string, unknown>;
};

type SymbolicCheckability =
  | { readonly checkable: true }
  | { readonly checkable: false; readonly reason: string; readonly evidence?: Record<string, unknown> };

const NO_EXTRACTABLE_EQUATION_REASON =
  "Question text does not contain an extractable equation for SymPy";
const NO_EXTRACTABLE_EQUATION_EVIDENCE: Record<string, unknown> = {
  extraction: "no_extractable_equation",
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
        status: check.status,
        duration_ms: Date.now() - started,
        evidence: sympyEvidence(check),
        failure_detail: failureDetailFor(check),
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
  const checkability = classifySymbolicCheckability(candidate);
  if (!checkability.checkable) {
    return unverifiedCheck(candidate, checkability.reason, checkability.evidence);
  }

  if (candidate.generation_kind === "equation") {
    if (isChoiceStyleCandidate(candidate)) {
      return verifyChoiceCandidate(mathEngine, candidate);
    }
    return verifyEquationCandidate(mathEngine, candidate);
  }

  return unverifiedCheck(
    candidate,
    `No deterministic SymPy verifier is implemented for generation_kind=${candidate.generation_kind}`,
  );
}

function classifySymbolicCheckability(candidate: GeneratedProblem): SymbolicCheckability {
  if (candidate.generation_kind !== "equation") {
    return {
      checkable: false,
      reason:
        "SymPy verification requires a checkable equation; non-equation candidates rely on independent re-solve",
      evidence: { generation_kind: candidate.generation_kind },
    };
  }

  const equation = extractEquationText(candidate.question_text);
  if (equation === null) {
    return {
      checkable: false,
      reason: NO_EXTRACTABLE_EQUATION_REASON,
      evidence: NO_EXTRACTABLE_EQUATION_EVIDENCE,
    };
  }

  if (isChoiceStyleCandidate(candidate) && resolveChoiceOptions(candidate).length === 0) {
    return {
      checkable: false,
      reason: "Multiple-choice equation has no parseable expected_choices/options",
      evidence: { equation },
    };
  }

  return { checkable: true };
}

async function verifyEquationCandidate(
  mathEngine: MathEngineClient,
  candidate: GeneratedProblem,
): Promise<VerificationCheck> {
  const equation = extractEquationText(candidate.question_text);
  if (equation === null) {
    return unverifiedCheck(
      candidate,
      NO_EXTRACTABLE_EQUATION_REASON,
      NO_EXTRACTABLE_EQUATION_EVIDENCE,
    );
  }

  const solved = await solveEquation(mathEngine, equation);
  if (solved.solutions.length === 0) {
    return unverifiedCheck(candidate, solved.reason, { equation });
  }

  const expected = parseExpectedSolutions(candidate.expected_answer);
  if (expected.length === 0) {
    return unverifiedCheck(
      candidate,
      "Expected answer contains no parseable symbolic solutions",
      { equation, sympy_solutions: solved.solutions },
      candidate.expected_answer,
      solved.solutions.join(", "),
    );
  }

  const actualCanonical = await tryCanonicalizeAll(mathEngine, solved.solutions);
  const expectedCanonical = await tryCanonicalizeAll(mathEngine, expected);
  if (actualCanonical === null || expectedCanonical === null) {
    return unverifiedCheck(
      candidate,
      "math-engine could not canonicalize the declared answer or SymPy solutions",
      { equation, expected_solutions: expected, sympy_solutions: solved.solutions },
      expected.join(", "),
      solved.solutions.join(", "),
    );
  }

  const passed = sameSet(actualCanonical, expectedCanonical);
  return {
    status: passed ? "passed" : "failed",
    verificationKind: candidate.generation_kind,
    expectedAnswer: expected.join(", "),
    sympyAnswer: solved.solutions.join(", "),
    failureCode: passed ? undefined : "sympy_solution_mismatch",
    failureMessage: passed
      ? undefined
      : "SymPy solution did not match the expected answer",
    evidence: {
      equation,
      expected_canonical: expectedCanonical,
      sympy_canonical: actualCanonical,
    },
  };
}

async function verifyChoiceCandidate(
  mathEngine: MathEngineClient,
  candidate: GeneratedProblem,
): Promise<VerificationCheck> {
  const equation = extractEquationText(candidate.question_text);
  if (equation === null) {
    return unverifiedCheck(
      candidate,
      NO_EXTRACTABLE_EQUATION_REASON,
      NO_EXTRACTABLE_EQUATION_EVIDENCE,
    );
  }

  const choices = resolveChoiceOptions(candidate);
  if (choices.length < 2) {
    return unverifiedCheck(candidate, "Multiple-choice verification requires at least two parseable options", {
      equation,
      choice_count: choices.length,
    });
  }

  const correctChoice = selectDeclaredCorrectChoice(candidate, choices);
  if (correctChoice === null) {
    return unverifiedCheck(
      candidate,
      "Declared expected_answer does not identify one of the provided choices",
      { equation, expected_answer: candidate.expected_answer, choices: choices.map(formatChoice) },
    );
  }

  const solved = await solveEquation(mathEngine, equation);
  if (solved.solutions.length === 0) {
    return unverifiedCheck(candidate, solved.reason, {
      equation,
      correct_choice: formatChoice(correctChoice),
    });
  }

  const correctDecision = await decideAnswerMatchesSolutions(
    mathEngine,
    correctChoice.body,
    solved.solutions,
  );
  if (correctDecision.status === "undecidable") {
    return unverifiedCheck(
      candidate,
      `Could not compare declared correct choice with SymPy solutions: ${decisionReason(correctDecision)}`,
      {
        equation,
        correct_choice: formatChoice(correctChoice),
        sympy_solutions: solved.solutions,
      },
      correctChoice.body,
      solved.solutions.join(", "),
    );
  }
  if (correctDecision.status === "not_equivalent") {
    return {
      status: "failed",
      verificationKind: candidate.generation_kind,
      expectedAnswer: correctChoice.body,
      sympyAnswer: solved.solutions.join(", "),
      failureCode: "multiple_choice_correct_mismatch",
      failureMessage: `Declared correct choice ${formatChoice(correctChoice)} does not match SymPy solutions ${solved.solutions.join(", ")}`,
      evidence: {
        equation,
        correct_choice: formatChoice(correctChoice),
        sympy_solutions: solved.solutions,
        equivalence: correctDecision,
      },
    };
  }

  const pairCheck = await findChoicePairIssue(mathEngine, choices);
  if (pairCheck !== null && pairCheck.status === "equivalent") {
    return {
      status: "failed",
      verificationKind: candidate.generation_kind,
      expectedAnswer: correctChoice.body,
      sympyAnswer: solved.solutions.join(", "),
      failureCode: "multiple_choice_duplicate_equivalent_options",
      failureMessage: `Choice options ${formatChoice(pairCheck.left)} and ${formatChoice(pairCheck.right)} are equivalent duplicates`,
      evidence: {
        equation,
        duplicate_choices: [formatChoice(pairCheck.left), formatChoice(pairCheck.right)],
        equivalence: pairCheck.decision,
      },
    };
  }
  if (pairCheck !== null && pairCheck.status === "undecidable") {
    return unverifiedCheck(
      candidate,
      `Could not prove choices non-equivalent: ${decisionReason(pairCheck.decision)}`,
      {
        equation,
        undecidable_choices: [formatChoice(pairCheck.left), formatChoice(pairCheck.right)],
        equivalence: pairCheck.decision,
      },
      correctChoice.body,
      solved.solutions.join(", "),
    );
  }

  return {
    status: "passed",
    verificationKind: candidate.generation_kind,
    expectedAnswer: correctChoice.body,
    sympyAnswer: solved.solutions.join(", "),
    evidence: {
      equation,
      correct_choice: formatChoice(correctChoice),
      choice_count: choices.length,
    },
  };
}

async function solveEquation(
  mathEngine: MathEngineClient,
  equation: string,
): Promise<{ readonly solutions: string[]; readonly reason: string }> {
  try {
    const solved = await mathEngine.solve({ equation });
    return {
      solutions: solved.solutions,
      reason:
        solved.solutions.length === 0
          ? "math-engine returned no symbolic solutions"
          : "math-engine solved the equation",
    };
  } catch (err) {
    return {
      solutions: [],
      reason: `math-engine could not solve the equation: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function unverifiedCheck(
  candidate: GeneratedProblem,
  reason: string,
  evidence?: Record<string, unknown>,
  expectedAnswer?: string,
  sympyAnswer?: string,
): VerificationCheck {
  return {
    status: "unverified",
    verificationKind: candidate.generation_kind,
    reason,
    expectedAnswer,
    sympyAnswer,
    evidence,
  };
}

function sympyEvidence(check: VerificationCheck): Record<string, unknown> {
  return {
    engine: "sympy",
    verification_kind: check.verificationKind,
    status: check.status,
    ...(check.expectedAnswer === undefined ? {} : { expected_answer: check.expectedAnswer }),
    ...(check.sympyAnswer === undefined ? {} : { sympy_answer: check.sympyAnswer }),
    ...(check.reason === undefined ? {} : { reason: check.reason }),
    ...(check.evidence ?? {}),
  };
}

function failureDetailFor(check: VerificationCheck): GateResult["failure_detail"] {
  if (check.status === "passed") return undefined;
  if (check.status === "unverified") {
    return {
      code: "sympy_unverified",
      message: check.reason ?? "SymPy could not decide this candidate",
    };
  }
  return {
    code: check.failureCode ?? "sympy_solution_mismatch",
    message: check.failureMessage ?? "SymPy solution did not match the expected answer",
  };
}

function isChoiceStyleCandidate(candidate: GeneratedProblem): boolean {
  return (
    (candidate.expected_choices !== undefined && candidate.expected_choices.length > 0) ||
    (/[①②③④⑤⑥⑦⑧⑨]|\([1-9]\)|[1-9][).]/u.test(candidate.question_text) &&
      /^(?:[①②③④⑤⑥⑦⑧⑨]|\([1-9]\)|[1-9][).]|[1-9]번)\s*/u.test(candidate.expected_answer.trim()))
  );
}

function resolveChoiceOptions(candidate: GeneratedProblem): ChoiceOption[] {
  const expectedChoices = choiceOptionsFromExpectedChoices(candidate.expected_choices);
  return expectedChoices.length > 0 ? expectedChoices : extractChoiceOptions(candidate.question_text);
}

function selectDeclaredCorrectChoice(
  candidate: GeneratedProblem,
  choices: readonly ChoiceOption[],
): ChoiceOption | null {
  const expectedIndex = choiceIndexFromAnswer(candidate.expected_answer);
  if (expectedIndex !== null) {
    return choices.find((choice) => choice.index === expectedIndex) ?? null;
  }

  const expectedBody = stripChoicePrefix(candidate.expected_answer);
  return choices.find((choice) => samePlainChoiceBody(choice.body, expectedBody)) ?? null;
}

type ChoicePairIssue = {
  readonly status: "equivalent" | "undecidable";
  readonly left: ChoiceOption;
  readonly right: ChoiceOption;
  readonly decision: AnswerEquivalenceDecision;
};

async function findChoicePairIssue(
  mathEngine: MathEngineClient,
  choices: readonly ChoiceOption[],
): Promise<ChoicePairIssue | null> {
  let firstUndecidable: ChoicePairIssue | null = null;
  for (let leftIndex = 0; leftIndex < choices.length; leftIndex += 1) {
    const left = choices[leftIndex];
    if (left === undefined) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < choices.length; rightIndex += 1) {
      const right = choices[rightIndex];
      if (right === undefined) continue;
      const decision = await decideAnswerEquivalence(mathEngine, left.body, right.body);
      if (decision.status === "equivalent") {
        return { status: "equivalent", left, right, decision };
      }
      if (decision.status === "undecidable" && firstUndecidable === null) {
        firstUndecidable = { status: "undecidable", left, right, decision };
      }
    }
  }
  return firstUndecidable;
}

function decisionReason(decision: AnswerEquivalenceDecision): string {
  return decision.reason ?? decision.status;
}

function formatChoice(choice: ChoiceOption): string {
  return `${choice.label} ${choice.body}`.trim();
}

function samePlainChoiceBody(left: string, right: string): boolean {
  return stripChoicePrefix(left).replace(/\s+/g, "") === stripChoicePrefix(right).replace(/\s+/g, "");
}

function parseExpectedSolutions(answer: string): string[] {
  return answer
    .split(/[,;]|또는|or/)
    .map((part) => part.trim())
    .map((part) => part.replace(/^[a-zA-Z]\s*=\s*/, ""))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

async function tryCanonicalizeAll(
  mathEngine: MathEngineClient,
  expressions: readonly string[],
): Promise<string[] | null> {
  try {
    return await canonicalizeAll(mathEngine, expressions);
  } catch (_err) {
    return null;
  }
}

async function canonicalizeAll(
  mathEngine: MathEngineClient,
  expressions: readonly string[],
): Promise<string[]> {
  const canonical = await Promise.all(
    expressions.map(async (expr) => {
      const result = await mathEngine.simplify({ expr });
      return result.simplified.replace(/\s+/g, "");
    }),
  );
  return canonical.sort();
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}
