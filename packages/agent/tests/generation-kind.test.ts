import { describe, expect, it } from "vitest";

import { generationKindForTopic } from "../src/schemas/index.js";

describe("generationKindForTopic", () => {
  it("maps app topics to verification-oriented generation kinds", () => {
    expect(generationKindForTopic("9수02-03")).toBe("equation");
    expect(generationKindForTopic("9수02-06")).toBe("inequality");
    expect(generationKindForTopic("9수02-07")).toBe("system");
    expect(generationKindForTopic("9수02-08")).toBe("expression");
    expect(generationKindForTopic("9수03-04")).toBe("function");
    expect(generationKindForTopic("9수04-05")).toBe("geometry");
    expect(generationKindForTopic("9수05-02")).toBe("probability");
    expect(generationKindForTopic("9수05-03")).toBe("statistics");
  });

  it("falls back to expression for unknown middle-school topics", () => {
    expect(generationKindForTopic("9수99-99")).toBe("expression");
  });
});
