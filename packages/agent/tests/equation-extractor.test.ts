import { describe, expect, it } from "vitest";

import { extractEquationText } from "../src/tools/equation-extractor.js";

describe("extractEquationText", () => {
  it("extracts a solvable equation from Korean problem prose", () => {
    expect(extractEquationText("다음 방정식을 풀어라. x^{2} - 5x + 6 = 0")).toBe(
      "x^(2) - 5x + 6 = 0",
    );
  });

  it("preserves leading parentheses in extracted equations", () => {
    expect(extractEquationText("다음 이차방정식의 해를 구하시오. (x-1)(x+4)=4 x+2")).toBe(
      "(x-1)(x+4)=4 x+2",
    );
  });

  it("drops trailing Korean instructions after the equation", () => {
    expect(
      extractEquationText("다음 이차방정식의 해를 구하시오. 4 x^{2} - 4 x - 3 = 0. (구한 해를 원래 식에 대입하여 확인할 것)"),
    ).toBe("4 x^(2) - 4 x - 3 = 0");
  });

  it.each([
    { label: "≤", text: "다음 부등식을 풀어라. x² − 3x ≤ 0", expected: "x^(2) - 3x <= 0" },
    { label: "≥", text: "다음 부등식을 풀어라. 2×x ≥ 6", expected: "2*x >= 6" },
    { label: "≠", text: "조건을 만족하시오. x ≠ 0", expected: "x != 0" },
    { label: "÷", text: "다음 식을 풀어라. x ÷ 2 = 3", expected: "x / 2 = 3" },
    { label: "·", text: "다음 식을 풀어라. 3·x = 9", expected: "3*x = 9" },
  ])("normalizes unicode math operator $label", ({ text, expected }) => {
    expect(extractEquationText(text)).toBe(expected);
  });

  it.each([
    { label: "\\( ... \\)", text: "다음 방정식을 풀어라. \\( x + 1 = 2 \\)", expected: "x + 1 = 2" },
    { label: "$...$", text: "다음 방정식을 풀어라. $x + 1 = 2$", expected: "x + 1 = 2" },
    { label: "\\[ ... \\]", text: "다음 방정식을 풀어라. \\[ x + 1 = 2 \\]", expected: "x + 1 = 2" },
  ])("strips inline LaTeX wrapper $label", ({ text, expected }) => {
    expect(extractEquationText(text)).toBe(expected);
  });

  it.each([
    { label: "\\frac", text: "다음 방정식을 풀어라. \\frac{x}{2}=3", expected: "(x)/(2)=3" },
    { label: "\\times", text: "다음 방정식을 풀어라. 2 \\times x = 6", expected: "2 * x = 6" },
    { label: "\\div", text: "다음 방정식을 풀어라. x \\div 2 = 3", expected: "x / 2 = 3" },
    { label: "\\cdot", text: "다음 방정식을 풀어라. 3\\cdot x = 9", expected: "3* x = 9" },
    { label: "\\le", text: "다음 부등식을 풀어라. x \\le 2", expected: "x <= 2" },
    { label: "\\leq", text: "다음 부등식을 풀어라. x \\leq 2", expected: "x <= 2" },
    { label: "\\ge", text: "다음 부등식을 풀어라. x \\ge 2", expected: "x >= 2" },
    { label: "\\geq", text: "다음 부등식을 풀어라. x \\geq 2", expected: "x >= 2" },
    { label: "\\ne", text: "조건을 만족하시오. x \\ne 0", expected: "x != 0" },
    { label: "^{...}", text: "다음 방정식을 풀어라. x^{3}=8", expected: "x^(3)=8" },
  ])("normalizes LaTeX form $label", ({ text, expected }) => {
    expect(extractEquationText(text)).toBe(expected);
  });

  it("returns null when a problem has no equation", () => {
    expect(extractEquationText("다음 중 두 다항식의 공통 인수를 고르시오.")).toBeNull();
  });
});
