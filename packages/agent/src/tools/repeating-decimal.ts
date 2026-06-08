export interface RepeatingDecimalFraction {
  readonly numerator: string;
  readonly denominator: string;
}

export function fractionFromRepeatingDecimalQuestion(question: string): RepeatingDecimalFraction | null {
  const match = question.match(/순환소수\s*([0-9]+)\.([0-9]+)\.\.\./u);
  if (match === null) return null;
  const integerPart = match[1] ?? "";
  const decimalPart = match[2] ?? "";
  const repeating = detectRepeatingTail(decimalPart);
  if (integerPart.length === 0 || repeating === null) return null;

  const nonRepeatingDigits = decimalPart.slice(0, decimalPart.length - repeating.length);
  const nonRepeating = nonRepeatingDigits.length === 0 ? 0n : BigInt(nonRepeatingDigits);
  const repeatValue = BigInt(repeating);
  const nonRepeatingScale = 10n ** BigInt(nonRepeatingDigits.length);
  const repeatScale = 10n ** BigInt(repeating.length) - 1n;
  const denominator = nonRepeatingScale * repeatScale;
  const numerator = BigInt(integerPart) * denominator + nonRepeating * repeatScale + repeatValue;
  const divisor = gcd(abs(numerator), denominator);
  return {
    numerator: (numerator / divisor).toString(),
    denominator: (denominator / divisor).toString(),
  };
}

export function sameFractionText(left: string, right: RepeatingDecimalFraction): boolean {
  const match = left.trim().match(/^([+-]?\d+)\s*\/\s*(\d+)$/u);
  if (match === null) return false;
  const numerator = BigInt(match[1] ?? "0");
  const denominator = BigInt(match[2] ?? "1");
  if (denominator === 0n) return false;
  const divisor = gcd(abs(numerator), denominator);
  return (
    (numerator / divisor).toString() === right.numerator &&
    (denominator / divisor).toString() === right.denominator
  );
}

function detectRepeatingTail(decimalPart: string): string | null {
  for (let width = 1; width <= Math.min(4, Math.floor(decimalPart.length / 2)); width += 1) {
    const block = decimalPart.slice(decimalPart.length - width);
    const repeated = repeatedSuffixLength(decimalPart, block);
    if (repeated >= width * 2) return block;
  }
  return null;
}

function repeatedSuffixLength(value: string, block: string): number {
  let cursor = value.length;
  let total = 0;
  while (cursor >= block.length && value.slice(cursor - block.length, cursor) === block) {
    total += block.length;
    cursor -= block.length;
  }
  return total;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}
