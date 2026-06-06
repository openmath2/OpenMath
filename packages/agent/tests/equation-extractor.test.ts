import { describe, expect, it } from "vitest";

import { extractEquationText } from "../src/tools/equation-extractor.js";

describe("extractEquationText", () => {
  it("extracts a solvable equation from Korean problem prose", () => {
    expect(extractEquationText("다음 방정식을 풀어라. x^{2} - 5x + 6 = 0")).toBe(
      "x^{2} - 5x + 6 = 0",
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
    ).toBe("4 x^{2} - 4 x - 3 = 0");
  });

  it("returns null when a problem has no equation", () => {
    expect(extractEquationText("다음 중 두 다항식의 공통 인수를 고르시오.")).toBeNull();
  });
});
