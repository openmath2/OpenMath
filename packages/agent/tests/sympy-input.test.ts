import { describe, expect, it } from "vitest";

import { toSympyInput } from "../src/tools/sympy-input.js";

describe("toSympyInput", () => {
  it("normalizes bare and latex sqrt notation", () => {
    expect(toSympyInput("12 + 8sqrt{3}")).toBe("12 + 8*sqrt(3)");
    expect(toSympyInput("12 + 8\\sqrt{3}")).toBe("12 + 8*sqrt(3)");
  });
});
