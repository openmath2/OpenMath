import { describe, expect, it } from "vitest";

import { formatLatex, toSympyExpr } from "../src/tools/index.js";

describe("formatLatex", () => {
  it("formats powers", () => {
    expect(formatLatex("x**2 - 5 = 0")).toBe("x^{2} - 5 = 0");
  });

  it("formats multiplication", () => {
    expect(formatLatex("2*x + 3*y = 0")).toBe("2 x + 3 y = 0");
  });

  it("formats square roots", () => {
    expect(formatLatex("sqrt(7), -sqrt(x + 1)")).toBe("\\sqrt{7}, -\\sqrt{x + 1}");
  });

  it("formats fractions", () => {
    expect(formatLatex("frac(x + 1, 2)")).toBe("\\frac{x + 1}{2}");
  });

  it("formats mixed expressions", () => {
    expect(formatLatex("2*x**2 + sqrt(frac(1, 4)) = 3")).toBe(
      "2 x^{2} + \\sqrt{\\frac{1}{4}} = 3",
    );
  });

  it("preserves identity strings", () => {
    expect(formatLatex("x + 1 = 2")).toBe("x + 1 = 2");
  });
});

describe("toSympyExpr", () => {
  it("strips inline math delimiters", () => {
    expect(toSympyExpr("$x=2$")).toBe("x=2");
    expect(toSympyExpr("\\(x+1=3\\)")).toBe("x+1=3");
  });

  it("converts LaTeX fractions while preserving equations", () => {
    expect(toSympyExpr("\\frac{1}{5}(2x+1)=-x+3")).toBe("((1)/(5))(2x+1)=-x+3");
  });

  it("extracts displayed equations from prose", () => {
    expect(toSympyExpr("방정식 $\\frac{1}{5}(2x+1)=-x+3$ 를 푸시오.")).toBe(
      "((1)/(5))(2x+1)=-x+3",
    );
  });

  it("converts square roots", () => {
    expect(toSympyExpr("\\sqrt{2}")).toBe("sqrt(2)");
  });

  it("converts common operators and constants", () => {
    expect(toSympyExpr("\\left(x^2 \\cdot \\pi\\right)")).toBe("(x**2 * pi)");
  });

  it("preserves bare numbers and extracts answer equations from prose", () => {
    expect(toSympyExpr("2")).toBe("2");
    expect(toSympyExpr("x=2")).toBe("x=2");
    expect(toSympyExpr("해는 x=2")).toBe("x=2");
    expect(toSympyExpr("x = 2 (개)")).toBe("x=2");
  });

  it("handles multiple roots and plus-minus notation", () => {
    expect(toSympyExpr("x = -2, 2")).toBe("x=-2, 2");
    expect(toSympyExpr("x=\\pm 2")).toBe("x=-2, 2");
  });

  it("converts display delimiters, dfrac, inequalities, and division", () => {
    expect(toSympyExpr("$\\dfrac{x}{2} \\le 3$")).toBe("((x)/(2))<=3");
    expect(toSympyExpr("6 \\div 3 \\ge 2")).toBe("6 / 3>=2");
  });
});
