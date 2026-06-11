/** Deterministic SymPy-string → KaTeX-safe LaTeX formatter (D-6 presentation boundary). */

export function formatLatex(value: string): string {
  return formatMultiplication(formatFractions(formatSqrt(formatPowers(value))));
}

export function toSympyExpr(value: string): string {
  let expression = stripMathDelimiters(extractMathSegment(value))
    .replace(/\s*\([^)]*[가-힣%]+[^)]*\)\s*$/u, "")
    .trim();
  expression = expression
    .replace(/\\left|\\right/g, "")
    .replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, "(($1)/($2))")
    .replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)")
    .replace(/\\cdot/g, "*")
    .replace(/\\div/g, " / ")
    .replace(/\\leq?|≤/g, "<=")
    .replace(/\\geq?|≥/g, ">=")
    .replace(/\\pi/g, "pi")
    .replace(/\\pm\s*([^\s,]+)/g, "-$1, $1")
    .replace(/\^/g, "**");
  expression = extractEquationText(expression)
    .replace(/\s*([=<>]=?)\s*/g, "$1")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
  return expression;
}

function extractMathSegment(value: string): string {
  const dollar = value.match(/\$([^$]+)\$/u)?.[1];
  if (dollar !== undefined) return dollar;
  const inline = value.match(/\\\(([\s\S]+?)\\\)/u)?.[1];
  if (inline !== undefined) return inline;
  return value;
}

function stripMathDelimiters(value: string): string {
  return value
    .trim()
    .replace(/^\$([\s\S]+)\$$/u, "$1")
    .replace(/^\\\(([\s\S]+)\\\)$/u, "$1")
    .replace(/^\\\[([\s\S]+)\\\]$/u, "$1");
}

function extractEquationText(value: string): string {
  const equation = value.match(/[A-Za-z]\s*=\s*[^.。]+/u)?.[0];
  return equation ?? value;
}

function formatPowers(value: string): string {
  return value.replace(/\*\*([A-Za-z0-9]+|\([^()]+\))/g, (_, exponent: string) => {
    const body = exponent.startsWith("(") && exponent.endsWith(")")
      ? exponent.slice(1, -1)
      : exponent;
    return `^{${body}}`;
  });
}

function formatSqrt(value: string): string {
  return replaceFunctionCalls(value, "sqrt", (inner) => `\\sqrt{${formatLatex(inner)}}`);
}

function formatFractions(value: string): string {
  return replaceFunctionCalls(value, "frac", (inner) => {
    const parts = splitTopLevelComma(inner);
    if (parts.length !== 2) return `frac(${inner})`;
    return `\\frac{${formatLatex(parts[0] ?? "")}}{${formatLatex(parts[1] ?? "")}}`;
  });
}

function formatMultiplication(value: string): string {
  return value.replace(/\s*\*\s*/g, " ");
}

function replaceFunctionCalls(
  value: string,
  functionName: string,
  render: (inner: string) => string,
): string {
  const needle = `${functionName}(`;
  let output = "";
  let index = 0;
  while (index < value.length) {
    const start = value.indexOf(needle, index);
    if (start === -1) {
      output += value.slice(index);
      break;
    }
    output += value.slice(index, start);
    const innerStart = start + needle.length;
    const end = findMatchingParen(value, innerStart - 1);
    if (end === -1) {
      output += value.slice(start);
      break;
    }
    output += render(value.slice(innerStart, end));
    index = end + 1;
  }
  return output;
}

function findMatchingParen(value: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitTopLevelComma(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}
