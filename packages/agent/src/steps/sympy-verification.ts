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
    // 엔진 장애/타임아웃은 수학적 판정이 아니다 — failed로 두면 acceptance가
    // 인프라 장애를 "틀린 문제"로 reject한다. unverified로 강등해 warning에 머문다.
    const message = err instanceof Error ? err.message : String(err);
    return {
      gate: {
        step: "sympy_verify",
        status: "unverified",
        duration_ms: Date.now() - started,
        evidence: { engine: "sympy", reason: `math-engine error: ${message}` },
        failure_detail: {
          code: "sympy_error",
          message,
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
    const equation = extractEquationText(candidate.question_text);
    if (equation !== null) {
      if (isChoiceStyleCandidate(candidate)) {
        if (resolveChoiceOptions(candidate).length === 0) {
          return unverifiedCheck(
            candidate,
            "Multiple-choice equation has no parseable expected_choices/options",
            { equation },
          );
        }
        return verifyChoiceCandidate(mathEngine, candidate);
      }
      return verifyEquationCandidate(mathEngine, candidate);
    }
    // 식 추출 실패 (서술형 방정식 문제 등) — 검증식이 있으면 평가 경로로 폴백.
    const byExpression = await verifyByExpression(mathEngine, candidate);
    if (byExpression !== null) return byExpression;
    return unverifiedCheck(
      candidate,
      NO_EXTRACTABLE_EQUATION_REASON,
      NO_EXTRACTABLE_EQUATION_EVIDENCE,
    );
  }

  const byExpression = await verifyByExpression(mathEngine, candidate);
  if (byExpression !== null) return byExpression;
  return unverifiedCheck(
    candidate,
    "SymPy verification requires a checkable equation; non-equation candidates rely on independent re-solve",
    { generation_kind: candidate.generation_kind },
  );
}

/** /evaluate가 식이 숫자로 떨어지지 않아 422로 거부했는지. math.py `_compute_evaluate`는
 *  HTTP 422 + "Expression did not evaluate to a number" detail로만 이 경우를 알린다.
 *  client는 `math-engine /evaluate failed (422): <body>` 형태로 던지므로(math-engine-client.ts),
 *  상태코드 422와 detail 문구를 모두 요구해 진짜 엔진 장애(5xx·타임아웃 등)가 symbolic으로
 *  오분류되지 않게 한다. 둘 중 하나라도 어긋나면 보수적으로 unverified에 머문다(false-fail 방지). */
function isNonNumericEvaluateError(message: string): boolean {
  return /\(422\)/.test(message) && message.includes("did not evaluate to a number");
}

/** 후보의 verification_expression을 선언 정답과 대조한다. 두 경로:
 *  - 숫자로 떨어지는 식(경우의 수 등)은 /evaluate로 평가값을 구해 대조한다.
 *  - 변수가 든 식(식 전개·간단히 등)은 /evaluate가 422를 던지므로, 원식 자체를
 *    선언 정답과 기호 동치(simplify+verify)로 대조한다.
 *  식이 없으면 null (호출자가 기존 unverified 폴백 유지). 동치 판정 자체가 불가능하면
 *  (파싱 실패 등) unverified — 식은 LLM 산출물이라 구문 오류가 수학 오류를 뜻하지 않는다.
 *  깔끔히 not_equivalent로 판정되면 failed(numeric·symbolic 동일). */
async function verifyByExpression(
  mathEngine: MathEngineClient,
  candidate: GeneratedProblem,
): Promise<VerificationCheck | null> {
  const expression = candidate.verification_expression;
  if (expression === undefined) return null;

  const declared = declaredAnswerBody(candidate);
  if (declared === null) {
    return unverifiedCheck(
      candidate,
      "Declared expected_answer does not identify one of the provided choices",
      { verification_expression: expression, expected_answer: candidate.expected_answer },
    );
  }

  let evaluatedValue: string | null = null;
  let evaluateError: string | null = null;
  try {
    evaluatedValue = (await mathEngine.evaluate({ expr: expression })).value;
  } catch (err) {
    evaluateError = err instanceof Error ? err.message : String(err);
    // /evaluate가 "숫자가 아닌 식"이라며 422로 거부한 경우만 기호 동치 경로로 폴백한다.
    // 그 외(타임아웃·5xx·파싱 오류 등)는 진짜 엔진 장애이므로 unverified로 남긴다 —
    // 식은 LLM 산출물이라 일시적 장애를 "틀린 문제"로 reject하면 안 된다.
    if (!isNonNumericEvaluateError(evaluateError)) {
      return unverifiedCheck(
        candidate,
        `math-engine could not evaluate the verification expression: ${evaluateError}`,
        { verification_expression: expression },
      );
    }
  }

  const isSymbolic = evaluatedValue === null;
  const compared = evaluatedValue ?? expression;
  const baseEvidence: Record<string, unknown> = isSymbolic
    ? { expression_check: true, symbolic_check: true, verification_expression: expression }
    : { expression_check: true, verification_expression: expression, evaluated_value: evaluatedValue };

  const decision = await decideAnswerEquivalence(mathEngine, declared, compared);
  if (decision.status === "undecidable") {
    return unverifiedCheck(
      candidate,
      isSymbolic
        ? `Could not symbolically compare declared answer with the verification expression${evaluateError === null ? "" : ` (evaluate: ${evaluateError})`}: ${decision.reason ?? "undecidable"}`
        : `Could not compare declared answer with evaluated verification expression: ${decision.reason ?? "undecidable"}`,
      baseEvidence,
      declared,
      compared,
    );
  }
  if (decision.status === "not_equivalent") {
    return {
      status: "failed",
      verificationKind: candidate.generation_kind,
      expectedAnswer: declared,
      sympyAnswer: compared,
      failureCode: isSymbolic ? "expression_symbolic_mismatch" : "expression_value_mismatch",
      failureMessage: isSymbolic
        ? `Verification expression ${expression} is not symbolically equivalent to the declared answer ${declared}`
        : `Verification expression evaluates to ${compared}, which does not match the declared answer ${declared}`,
      evidence: { ...baseEvidence, equivalence: decision },
    };
  }
  return {
    status: "passed",
    verificationKind: candidate.generation_kind,
    expectedAnswer: declared,
    sympyAnswer: compared,
    evidence: baseEvidence,
  };
}

/** 검증식 대조 대상이 되는 선언 정답 본문. 객관식이면 정답 보기의 본문,
 *  아니면 choice prefix(`① ` 등)를 벗긴 expected_answer. */
function declaredAnswerBody(candidate: GeneratedProblem): string | null {
  if (isChoiceStyleCandidate(candidate)) {
    const choices = resolveChoiceOptions(candidate);
    if (choices.length > 0) {
      const correct = selectDeclaredCorrectChoice(candidate, choices);
      return correct === null ? null : correct.body;
    }
  }
  const stripped = stripChoicePrefix(candidate.expected_answer);
  return stripped.length > 0 ? stripped : candidate.expected_answer;
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
