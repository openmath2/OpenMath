import { describe, expect, it } from "vitest";

import {
  fractionFromRepeatingDecimalQuestion,
  sameFractionText,
} from "../src/tools/repeating-decimal.js";

describe("repeating decimal fraction parsing", () => {
  it("computes a fraction when a repeating tail follows non-repeating digits", () => {
    const fraction = fractionFromRepeatingDecimalQuestion("순환소수 3.12454545...를 분수로 나타내시오.");

    expect(fraction).toEqual({ numerator: "3437", denominator: "1100" });
    expect(fraction === null ? false : sameFractionText("3437/1100", fraction)).toBe(true);
    expect(fraction === null ? false : sameFractionText("3437/1110", fraction)).toBe(false);
  });
});
