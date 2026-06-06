export function toSympyInput(value: string): string {
  return insertImplicitMultiplication(
    replaceLatexCommands(value)
      .replace(/sqrt\s*\{([^{}]+)\}/g, "sqrt($1)")
      .replace(/\\left|\\right/g, "")
      .replace(/\\cdot|\\times/g, "*")
      .replace(/−/g, "-")
      .replace(/\^\s*\{([^{}]+)\}/g, "**($1)")
      .replace(/\^\s*([A-Za-z0-9]+)/g, "**$1")
      .replace(/\\[,;!]/g, " "),
  ).trim();
}

function insertImplicitMultiplication(value: string): string {
  return value
    .replace(/\)\s*\(/g, ")*(")
    .replace(/([0-9])([A-Za-z])/g, "$1*$2")
    .replace(/([0-9])\s+([A-Za-z])/g, "$1*$2")
    .replace(/([0-9])\s*\(/g, "$1*(")
    .replace(/\)\s*([A-Za-z0-9])/g, ")*$1")
    .replace(/([A-Za-z])\s+\(/g, "$1*(");
}

function replaceLatexCommands(value: string): string {
  return replaceLatexCommand(
    replaceLatexCommand(value, "sqrt", (parts) => {
      const inner = parts[0] ?? "";
      return `sqrt(${toSympyInput(inner)})`;
    }),
    "frac",
    (parts) => {
      const numerator = parts[0] ?? "";
      const denominator = parts[1] ?? "";
      return `(${toSympyInput(numerator)})/(${toSympyInput(denominator)})`;
    },
  );
}

function replaceLatexCommand(
  value: string,
  command: string,
  render: (parts: readonly string[]) => string,
): string {
  const needle = `\\${command}`;
  let output = "";
  let index = 0;
  while (index < value.length) {
    const start = value.indexOf(needle, index);
    if (start === -1) {
      output += value.slice(index);
      break;
    }
    output += value.slice(index, start);
    const parts = readBraceParts(value, start + needle.length);
    if (parts === null) {
      output += value.slice(start, start + needle.length);
      index = start + needle.length;
      continue;
    }
    output += render(parts.values);
    index = parts.endIndex + 1;
  }
  return output;
}

function readBraceParts(
  value: string,
  startIndex: number,
): { readonly values: readonly string[]; readonly endIndex: number } | null {
  const values: string[] = [];
  let index = skipSpaces(value, startIndex);
  while (value[index] === "{") {
    const endIndex = findMatchingBrace(value, index);
    if (endIndex === -1) return null;
    values.push(value.slice(index + 1, endIndex));
    index = skipSpaces(value, endIndex + 1);
  }
  if (values.length === 0) return null;
  return { values, endIndex: index - 1 };
}

function skipSpaces(value: string, startIndex: number): number {
  let index = startIndex;
  while (value[index] === " ") {
    index += 1;
  }
  return index;
}

function findMatchingBrace(value: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < value.length; index += 1) {
    const char = value[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}
