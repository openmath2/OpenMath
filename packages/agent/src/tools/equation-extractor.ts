const EQUATION_PATTERN = /([0-9A-Za-z\\{}\s+\-*/^().]+=[0-9A-Za-z\\{}\s+\-*/^().]+)/u;

export function extractEquationText(text: string): string | null {
  const match = text.match(EQUATION_PATTERN);
  const equation = match?.[1]?.trim();
  if (equation === undefined || !equation.includes("=")) return null;
  return equation
    .replace(/^[\s.,:;!?]+/u, "")
    .replace(/\.\s*\(.+$/u, "")
    .replace(/\.\s*\($/u, "")
    .replace(/\.$/u, "")
    .replace(/\s+/g, " ");
}
