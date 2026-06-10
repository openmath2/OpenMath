import type { GeneratedProblem } from "../schemas/index.js";
import type { MathEngineClient } from "./math-engine-client.js";
import { extractEquationText } from "./equation-extractor.js";
import { fractionFromRepeatingDecimalQuestion, sameFractionText } from "./repeating-decimal.js";

export type AnswerEquivalenceStatus = "equivalent" | "not_equivalent" | "undecidable";

export interface AnswerEquivalenceDecision {
  status: AnswerEquivalenceStatus;
  reason?: string;
  leftCanonical?: readonly string[];
  rightCanonical?: readonly string[];
}

export interface AnswerEquivalenceDebug {
  skippedReasons: string[];
}

export interface ChoiceOption {
  readonly label: string;
  readonly body: string;
  readonly index: number;
}

export async function decideAnswerEquivalence(
  mathEngine: MathEngineClient,
  left: string,
  right: string,
): Promise<AnswerEquivalenceDecision> {
  const debug: AnswerEquivalenceDebug = { skippedReasons: [] };
  const leftAnswers = parseAnswers(left);
  const rightAnswers = parseAnswers(right);
  if (leftAnswers.length === 0 || rightAnswers.length === 0) {
    if (normalizeAnswerText(left) === normalizeAnswerText(right)) {
      return { status: "equivalent" };
    }
    return { status: "undecidable", reason: "answer contains no parseable symbolic parts" };
  }
  if (sameNormalizedSet(leftAnswers, rightAnswers)) return { status: "equivalent" };

  const canonical = await tryCanonicalizeBoth(mathEngine, leftAnswers, rightAnswers, debug);
  if (canonical !== null) {
    if (sameOrderedCanonicalSet(canonical.left, canonical.right)) {
      return { status: "equivalent", leftCanonical: canonical.left, rightCanonical: canonical.right };
    }
    if (leftAnswers.length === 1 && rightAnswers.length === 1) {
      const verifyDecision = await tryVerifyPair(mathEngine, leftAnswers[0] ?? "", rightAnswers[0] ?? "", debug);
      if (verifyDecision?.status === "equivalent") return verifyDecision;
    }
    return {
      status: "not_equivalent",
      leftCanonical: canonical.left,
      rightCanonical: canonical.right,
    };
  }

  if (leftAnswers.length === 1 && rightAnswers.length === 1) {
    const verifyDecision = await tryVerifyPair(mathEngine, leftAnswers[0] ?? "", rightAnswers[0] ?? "", debug);
    if (verifyDecision !== null) return verifyDecision;
  }

  return { status: "undecidable", reason: withSkippedReasons("math-engine could not compare the answers", debug) };
}

export async function decideAnswerMatchesSolutions(
  mathEngine: MathEngineClient,
  answer: string,
  solutions: readonly string[],
): Promise<AnswerEquivalenceDecision> {
  const debug: AnswerEquivalenceDebug = { skippedReasons: [] };
  if (solutions.length === 0) {
    return { status: "undecidable", reason: "math-engine returned no symbolic solutions" };
  }
  const answerParts = parseAnswers(answer);
  if (answerParts.length === 0) {
    return { status: "undecidable", reason: "declared answer contains no parseable symbolic parts" };
  }
  if (sameNormalizedSet(answerParts, solutions)) return { status: "equivalent" };

  const canonical = await tryCanonicalizeBoth(mathEngine, answerParts, solutions, debug);
  if (canonical !== null) {
    if (sameOrderedCanonicalSet(canonical.left, canonical.right)) {
      return { status: "equivalent", leftCanonical: canonical.left, rightCanonical: canonical.right };
    }
    if (answerParts.length === 1 && solutions.length === 1) {
      const verifyDecision = await tryVerifyPair(mathEngine, answerParts[0] ?? "", solutions[0] ?? "", debug);
      if (verifyDecision?.status === "equivalent") return verifyDecision;
    }
    return {
      status: "not_equivalent",
      leftCanonical: canonical.left,
      rightCanonical: canonical.right,
    };
  }

  if (answerParts.length === 1 && solutions.length === 1) {
    const verifyDecision = await tryVerifyPair(mathEngine, answerParts[0] ?? "", solutions[0] ?? "", debug);
    if (verifyDecision !== null) return verifyDecision;
  }

  return { status: "undecidable", reason: withSkippedReasons("math-engine could not compare answer to solutions", debug) };
}

export function choiceOptionsFromExpectedChoices(
  expectedChoices: readonly string[] | undefined,
): ChoiceOption[] {
  if (expectedChoices === undefined) return [];
  return expectedChoices
    .map((choice, index) => {
      const label = choiceLabelFromAnswer(choice) ?? circledChoiceLabel(index);
      const labelIndex = choiceIndex(label);
      const body = stripChoicePrefix(choice);
      return { label, body: body.length > 0 ? body : choice.trim(), index: labelIndex ?? index };
    })
    .filter((choice) => choice.body.length > 0);
}

export async function sameAnswer(
  mathEngine: MathEngineClient,
  candidate: GeneratedProblem,
  derivedAnswer: string,
  debug?: AnswerEquivalenceDebug,
): Promise<boolean> {
  const expectedGraphAnswer = normalizeGraphAnswer(candidate.expected_answer);
  const derivedGraphAnswer = normalizeGraphAnswer(derivedAnswer);
  if (expectedGraphAnswer !== null && expectedGraphAnswer === derivedGraphAnswer) return true;

  const expected = parseAnswers(candidate.expected_answer);
  const derived = parseAnswers(derivedAnswer);
  if (expected.length === 0 || derived.length === 0) return false;
  const orderedExpected = /(작은|큰)\s*것부터/u.test(candidate.question_text) && expected.length === 1 ? expected[0]?.split("<").map((part) => part.trim()).filter((part) => part.length > 0) : undefined;
  if (orderedExpected !== undefined && orderedExpected.length === derived.length && orderedExpected.every((answer, index) => normalizeAnswerText(answer) === normalizeAnswerText(derived[index] ?? ""))) return true;

  const expectedAlternatives = uniqueAnswers([
    ...expected,
    ...choiceAnswerAlternatives(candidate),
    ...prefixedChoiceAlternatives(expected),
    ...choiceLabelAlternatives(expected),
  ]);
  const derivedAlternatives = uniqueAnswers([
    ...derived,
    ...prefixedChoiceAlternatives(derived),
    ...choiceLabelAlternatives(derived),
  ]);
  if (
    expected.length === 1 ||
    derived.length === 1 ||
    expectedAlternatives.length > expected.length ||
    derivedAlternatives.length > derived.length
  ) {
    if (await answerListsOverlap(mathEngine, expectedAlternatives, derivedAlternatives, debug)) return true;
  }

  if (sameNormalizedSet(expected, derived)) return true;
  if (await expectedMatchesEquationSolve(mathEngine, candidate, expected, debug)) return true;
  if (expectedMatchesRepeatingDecimalQuestion(candidate, expected)) return true;

  const expectedCanonical = await tryCanonicalizeAll(mathEngine, expected, debug);
  const derivedCanonical = await tryCanonicalizeAll(mathEngine, derived, debug);
  if (expectedCanonical === null || derivedCanonical === null) return false;
  if (expectedCanonical.length !== derivedCanonical.length) return false;
  return expectedCanonical.every((value, index) => value === derivedCanonical[index]);
}

function expectedMatchesRepeatingDecimalQuestion(
  candidate: GeneratedProblem,
  expected: readonly string[],
): boolean {
  const fraction = fractionFromRepeatingDecimalQuestion(candidate.question_text);
  if (fraction === null) return false;
  return expected.some((answer) => sameFractionText(answer, fraction));
}

function parseAnswers(answer: string): string[] {
  return answer.replace(/\s*\([^)]*%[^)]*\)/gu, "")
    .replace(/(^|\s)\([1-9]\)\s+(?=\S)/gu, "$1;")
    .split(/[,;]|또는|or|\s+\/\s+/)
    .map((part) => part.trim().replace(/^[xyXY]\s*=\s*/, "").replace(/^[abAB]\s*=\s*\d+\s*일\s*때\s*/u, "").replace(/\s*\([^)]*%\)\s*$/u, ""))
    .filter((part) => part.length > 0 && !/^(?:예|네)$/u.test(part) && !/^[abAB]\s*=\s*\d+$/u.test(part) && !/해가\s*아(?:님|니다)/u.test(part));
}

async function tryCanonicalizeBoth(
  mathEngine: MathEngineClient,
  left: readonly string[],
  right: readonly string[],
  debug?: AnswerEquivalenceDebug,
): Promise<{ readonly left: string[]; readonly right: string[] } | null> {
  const leftCanonical = await tryCanonicalizeAll(mathEngine, left, debug);
  const rightCanonical = await tryCanonicalizeAll(mathEngine, right, debug);
  if (leftCanonical === null || rightCanonical === null) return null;
  return { left: leftCanonical, right: rightCanonical };
}

async function tryVerifyPair(
  mathEngine: MathEngineClient,
  left: string,
  right: string,
  debug?: AnswerEquivalenceDebug,
): Promise<AnswerEquivalenceDecision | null> {
  try {
    const verified = await mathEngine.verify({ expr1: left, expr2: right });
    return { status: verified.equivalent ? "equivalent" : "not_equivalent" };
  } catch (err) {
    recordSkippedReason(debug, `verify pair skipped: ${errorMessage(err)}`);
    return null;
  }
}

async function canonicalizeAll(mathEngine: MathEngineClient, answers: readonly string[]): Promise<string[]> {
  const canonical = await Promise.all(
    answers.map(async (answer) => {
      const result = await mathEngine.simplify({ expr: answer });
      return result.simplified.replace(/\s+/g, "");
    }),
  );
  return canonical.sort();
}

async function tryCanonicalizeAll(
  mathEngine: MathEngineClient,
  answers: readonly string[],
  debug?: AnswerEquivalenceDebug,
): Promise<string[] | null> {
  try {
    return await canonicalizeAll(mathEngine, answers);
  } catch (err) {
    recordSkippedReason(debug, `canonicalize skipped: ${errorMessage(err)}`);
    return null;
  }
}

function recordSkippedReason(debug: AnswerEquivalenceDebug | undefined, reason: string): void {
  debug?.skippedReasons.push(reason);
}

function withSkippedReasons(reason: string, debug: AnswerEquivalenceDebug): string {
  if (debug.skippedReasons.length === 0) return reason;
  return `${reason}; skipped: ${uniqueMessages(debug.skippedReasons).join("; ")}`;
}

function uniqueMessages(messages: readonly string[]): string[] {
  return [...new Set(messages)];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sameNormalizedSet(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = left.map((answer) => normalizeAnswerText(answer)).sort();
  const normalizedRight = right.map((answer) => normalizeAnswerText(answer)).sort();
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((answer, index) => answer === normalizedRight[index]);
}

function sameOrderedCanonicalSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((answer, index) => answer === right[index]);
}

async function answerListsOverlap(
  mathEngine: MathEngineClient,
  expected: readonly string[],
  derived: readonly string[],
  debug?: AnswerEquivalenceDebug,
): Promise<boolean> {
  for (const expectedAnswer of expected) {
    for (const derivedAnswer of derived) {
      if (normalizeAnswerText(expectedAnswer) === normalizeAnswerText(derivedAnswer)) {
        return true;
      }
      if (await sameCanonicalAnswer(mathEngine, expectedAnswer, derivedAnswer, debug)) {
        return true;
      }
      if (
        await sameLinearFactorRoot(mathEngine, expectedAnswer, derivedAnswer, debug) ||
        await sameLinearFactorRoot(mathEngine, derivedAnswer, expectedAnswer, debug)
      ) {
        return true;
      }
    }
  }
  return false;
}

async function sameCanonicalAnswer(
  mathEngine: MathEngineClient,
  left: string,
  right: string,
  debug?: AnswerEquivalenceDebug,
): Promise<boolean> {
  const canonical = await tryCanonicalizeAll(mathEngine, [left, right], debug);
  if (canonical !== null && canonical[0] === canonical[1]) return true;
  try {
    return (await mathEngine.verify({ expr1: left, expr2: right })).equivalent;
  } catch (err) {
    recordSkippedReason(debug, `canonical-answer verify skipped: ${errorMessage(err)}`);
    return false;
  }
}

async function sameLinearFactorRoot(
  mathEngine: MathEngineClient,
  factorAnswer: string,
  rootAnswer: string,
  debug?: AnswerEquivalenceDebug,
): Promise<boolean> {
  if (!/[a-zA-Z]/u.test(factorAnswer)) return false;
  try {
    const solved = await mathEngine.solve({ equation: `${factorAnswer}=0` });
    if (solved.solutions.length === 0) return false;
    const roots = await canonicalizeAll(mathEngine, solved.solutions);
    const answers = await canonicalizeAll(mathEngine, parseAnswers(rootAnswer));
    return roots.some((root) => answers.includes(root));
  } catch (err) {
    recordSkippedReason(debug, `linear-factor comparison skipped: ${errorMessage(err)}`);
    return false;
  }
}

async function expectedMatchesEquationSolve(
  mathEngine: MathEngineClient,
  candidate: GeneratedProblem,
  expected: readonly string[],
  debug?: AnswerEquivalenceDebug,
): Promise<boolean> {
  if (candidate.generation_kind !== "equation") return false;
  const equation = extractEquationText(candidate.question_text);
  if (equation === null) return false;
  try {
    const solved = await mathEngine.solve({ equation });
    if (solved.solutions.length === 0) return false;
    return sameNormalizedSet(expected, solved.solutions) || await sameCanonicalSets(mathEngine, expected, solved.solutions, debug);
  } catch (err) {
    recordSkippedReason(debug, `equation-solve comparison skipped: ${errorMessage(err)}`);
    return false;
  }
}

async function sameCanonicalSets(
  mathEngine: MathEngineClient,
  left: readonly string[],
  right: readonly string[],
  debug?: AnswerEquivalenceDebug,
): Promise<boolean> {
  const leftCanonical = await tryCanonicalizeAll(mathEngine, left, debug);
  const rightCanonical = await tryCanonicalizeAll(mathEngine, right, debug);
  if (leftCanonical === null || rightCanonical === null) return false;
  if (leftCanonical.length !== rightCanonical.length) return false;
  return leftCanonical.every((value, index) => value === rightCanonical[index]);
}

function choiceAnswerAlternatives(candidate: GeneratedProblem): string[] {
  const expected = parseAnswers(candidate.expected_answer);
  const choices = extractChoices(candidate.question_text);
  const alternatives = new Set(expected);
  for (const answer of expected) {
    const stripped = stripChoicePrefix(answer);
    if (stripped !== answer) {
      alternatives.add(stripped);
    }
    const choice = choices.find((item) => choiceLabelsMatch(item.label, answer));
    if (choice !== undefined) {
      alternatives.add(choice.body);
    }
  }
  return [...alternatives];
}

function prefixedChoiceAlternatives(answers: readonly string[]): string[] {
  return answers
    .map((answer) => stripChoicePrefix(answer))
    .filter((answer) => answer.length > 0);
}

function choiceLabelAlternatives(answers: readonly string[]): string[] {
  return answers
    .flatMap((answer) => {
      const label = answer.trim().match(/^(?:[①②③④⑤⑥⑦⑧⑨]|\([1-9]\)|[1-9][).]|[1-9]번)/u)?.[0] ?? "";
      const index = choiceIndex(label);
      return index === null ? [label] : [label, `${index + 1}`];
    })
    .filter((answer) => answer.length > 0);
}

function uniqueAnswers(answers: readonly string[]): string[] {
  return [...new Set(answers)];
}

export function extractChoiceOptions(question: string): ChoiceOption[] {
  const labelPattern = "(?<!\\S)(?:[①②③④⑤⑥⑦⑧⑨]|\\([1-9]\\)|[1-9][).](?=\\s))";
  const pattern = new RegExp(`(${labelPattern})\\s*([\\s\\S]*?)(?=\\s*(?:${labelPattern})\\s*|$)`, "gu");
  return Array.from(question.matchAll(pattern))
    .map((match) => {
      const label = match[1] ?? "";
      const index = choiceIndex(label);
      return {
        label,
        body: (match[2] ?? "").trim(),
        index: index ?? -1,
      };
    })
    .filter((choice) => choice.index >= 0 && choice.body.length > 0);
}

function extractChoices(question: string): ChoiceOption[] {
  return extractChoiceOptions(question);
}

function choiceLabelsMatch(label: string, answer: string): boolean {
  const index = choiceIndex(label);
  if (index === null) return false;
  const normalized = answer.trim();
  return (
    normalized.startsWith(label) ||
    normalized.startsWith(circledChoiceLabel(index)) ||
    normalized === `${index + 1}` ||
    normalized === `${index + 1}번`
  );
}

export function stripChoicePrefix(answer: string): string {
  const labelPattern = /^(?:[①②③④⑤⑥⑦⑧⑨]|\([1-9]\)|[1-9][).]|[1-9]번)\s*/u;
  return answer.replace(labelPattern, "").trim();
}

export function choiceLabelFromAnswer(answer: string): string | null {
  return answer.trim().match(/^(?:[①②③④⑤⑥⑦⑧⑨]|\([1-9]\)|[1-9][).]|[1-9]번)/u)?.[0] ?? null;
}

export function choiceIndexFromAnswer(answer: string): number | null {
  const label = choiceLabelFromAnswer(answer);
  return label === null ? null : choiceIndex(label);
}

function choiceIndex(label: string): number | null {
  const circled = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
  const circledIndex = circled.indexOf(label);
  if (circledIndex >= 0) return circledIndex;
  const digit = label.match(/[1-9]/u)?.[0];
  return digit === undefined ? null : Number.parseInt(digit, 10) - 1;
}

function circledChoiceLabel(index: number): string {
  const labels = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
  return labels[index] ?? "";
}

function normalizeAnswerText(answer: string): string {
  const normalized = answer
    .replace(/(?:\\?sqrt\{([^{}]+)\}|√\s*([0-9]+))/gu, (_match, latex, unicode) => `sqrt(${latex ?? unicode})`)
    .replace(/sqrt([0-9]+)/gu, "sqrt($1)")
    .replace(/0\.(\d)\1{2,}\.\.\./gu, "0.($1)")
    .replace(/[\s*]+/g, "")
    .replace(/^[가-힣A-Z∠]+[A-Z]*=|^\d+=/u, "")
    .replace(/^[가-힣A-Z∠:]+(?=[+\-]?\d|sqrt|\\sqrt)/u, "")
    .replace(/(모둠|개|명|cm|kcal|도|원)$/u, "")
    .replace(/(?:모둠|개|명|cm|kcal|도|원)?(?:이고|이다|입니다)[.]?$/u, "")
    .replace(/^[㈎-㈖]|\([가-힣]\)|^식의값은|^선분/u, "")
    .replace(/(덧셈의|곱셈의)|x가증가하면y는(증가|감소)/gu, (_value, _law, trend) => trend ?? "")
    .replace(/(?:위|아래)로열린(?:다|포물선)/gu, (value) => `${value.startsWith("위") ? "위" : "아래"}로열림`)
    .replace(/^(위|아래)로$/u, "$1로열림")
    .replace(/한점에서만난다|.*접한다(?:\(.*\))?\.?|.*접선.*|.*두점에서만난다.*/gu, (value) => value.includes("두점") ? "twopoints" : "tangent")
    .replace(/실수범위에서(?:는)?정의되지않음|실수가아니다/gu, "notreal")
    .toLowerCase();
  return sortPositiveAdditionTerms(normalized);
}

function normalizeGraphAnswer(answer: string): string | null {
  const normalized = answer.replace(/\s+/g, "").replace(/[,.，。]/gu, "");
  if (!(normalized.includes("그래프위의점") || normalized.includes("그래프위에있") || /^(예|맞다)/u.test(normalized))) return null;
  if (/아래로열(?:린다|린포물선)/u.test(normalized)) return "그래프위의점+아래로열림";
  if (/위로열(?:린다|린포물선)/u.test(normalized)) return "그래프위의점+위로열림";
  return null;
}

function sortPositiveAdditionTerms(value: string): string {
  if (!value.includes("+") || value.includes("-") || /[=<>]/u.test(value)) return value;
  return value.split("+").sort().join("+");
}
