import { describe, expect, it } from "vitest";

import { createFsStrategyLoader } from "../src/tools/schema-loader.js";

describe("createFsStrategyLoader", () => {
  it("loads demo strategy YAML files", async () => {
    const loader = createFsStrategyLoader({
      strategiesDir: "data/achievement-standards",
    });

    const quadratic = await loader.load("9수02-09");
    expect(quadratic?.title).toBe("이차방정식");
    expect(quadratic?.evaluation_dimensions.some((d) => d.must_preserve)).toBe(
      true,
    );

    const all = await loader.loadAll();
    expect(all.map((strategy) => strategy.code)).toEqual(
      expect.arrayContaining(["9수02-03", "9수02-07", "9수02-09", "9수01-05", "10공수01-01"]),
    );
    expect(all).toHaveLength(43);
  });
});
