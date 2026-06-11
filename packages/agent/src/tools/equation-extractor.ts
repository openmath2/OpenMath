const EQUATION_PATTERN = /([0-9A-Za-z\s+\-*\/^().{}]+(?:<=|>=|!=|=|<|>)[0-9A-Za-z\s+\-*\/^().{}]+)/u;
const COMPARISON_PATTERN = /(?:<=|>=|!=|=|<|>)/u;

const UNICODE_OPERATOR_REPLACEMENTS: readonly (readonly [string, string])[] = [
  ["≤", "<="],
  ["≥", ">="],
  ["≠", "!="],
  ["÷", "/"],
  ["×", "*"],
  ["−", "-"],
  ["·", "*"],
];

const SUPERSCRIPT_REPLACEMENTS: Readonly<Record<string, string>> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁺": "+",
  "⁻": "-",
};

export function extractEquationText(text: string): string | null {
  const normalized = normalizeMathText(text);
  const match = normalized.match(EQUATION_PATTERN);
  const equation = match?.[1]?.trim();
  if (equation === undefined || !COMPARISON_PATTERN.test(equation)) return null;

  const cleaned = equation
    .replace(/^[\s.,:;!?]+/u, "")
    .replace(/\.\s*\(.+$/u, "")
    .replace(/\.\s*\($/u, "")
    .replace(/\.$/u, "")
    .replace(/\s+/g, " ")
    .trim();

  return COMPARISON_PATTERN.test(cleaned) ? cleaned : null;
}

function normalizeMathText(text: string): string {
  return normalizeUnicodeSuperscripts(
    normalizeUnicodeOperators(
      replaceLatexShorthands(
        replaceBracedPowers(replaceLatexFractions(stripInlineLatexWrappers(text))),
      ),
    ),
  ).replace(/\s+/g, " ");
}

function stripInlineLatexWrappers(text: string): string {
  return text.replace(/\\\(|\\\)|\\\[|\\\]/g, " ").replace(/\$/g, " ");
}

function replaceLatexShorthands(text: string): string {
  return text
    .replace(/\\left|\\right/g, "")
    .replace(/\\times(?![A-Za-z])/g, "*")
    .replace(/\\div(?![A-Za-z])/g, "/")
    .replace(/\\cdot(?![A-Za-z])/g, "*")
    .replace(/\\leq?(?![A-Za-z])/g, "<=")
    .replace(/\\geq?(?![A-Za-z])/g, ">=")
    .replace(/\\ne(?![A-Za-z])/g, "!=")
    .replace(/\\[,;!]/g, " ");
}

function replaceLatexFractions(text: string): string {
  const needle = "\\frac";
  let output = "";
  let index = 0;

  while (index < text.length) {
    const start = text.indexOf(needle, index);
    if (start === -1) {
      output += text.slice(index);
      break;
    }

    output += text.slice(index, start);
    const parts = readRequiredBraceParts(text, start + needle.length, 2);
    if (parts === null) {
      output += needle;
      index = start + needle.length;
      continue;
    }

    const numerator = parts.values[0] ?? "";
    const denominator = parts.values[1] ?? "";
    output += `(${normalizeMathText(numerator)})/(${normalizeMathText(denominator)})`;
    index = parts.endIndex + 1;
  }

  return output;
}

function replaceBracedPowers(text: string): string {
  let output = "";
  let index = 0;

  while (index < text.length) {
    const start = text.indexOf("^", index);
    if (start === -1) {
      output += text.slice(index);
      break;
    }

    output += text.slice(index, start);
    const braceStart = skipSpaces(text, start + 1);
    if (text[braceStart] !== "{") {
      output += text.slice(start, braceStart);
      index = braceStart;
      continue;
    }

    const endIndex = findMatchingBrace(text, braceStart);
    if (endIndex === -1) {
      output += text.slice(start);
      break;
    }

    output += `^(${normalizeMathText(text.slice(braceStart + 1, endIndex))})`;
    index = endIndex + 1;
  }

  return output;
}

function normalizeUnicodeOperators(text: string): string {
  let normalized = text;
  for (const [source, replacement] of UNICODE_OPERATOR_REPLACEMENTS) {
    normalized = normalized.split(source).join(replacement);
  }
  return normalized;
}

function normalizeUnicodeSuperscripts(text: string): string {
  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/gu, (match) => {
    const exponent = Array.from(match)
      .map((char) => SUPERSCRIPT_REPLACEMENTS[char] ?? "")
      .join("");
    return exponent.length > 0 ? `^(${exponent})` : match;
  });
}

function readRequiredBraceParts(
  text: string,
  startIndex: number,
  partCount: number,
): { readonly values: readonly string[]; readonly endIndex: number } | null {
  const values: string[] = [];
  let index = skipSpaces(text, startIndex);
  let endIndex = index;

  while (values.length < partCount) {
    if (text[index] !== "{") return null;
    endIndex = findMatchingBrace(text, index);
    if (endIndex === -1) return null;
    values.push(text.slice(index + 1, endIndex));
    index = skipSpaces(text, endIndex + 1);
  }

  return { values, endIndex };
}

function skipSpaces(text: string, startIndex: number): number {
  let index = startIndex;
  while (text[index] === " ") {
    index += 1;
  }
  return index;
}

function findMatchingBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}
