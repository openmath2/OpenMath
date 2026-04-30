import { describe, expect, it } from "vitest";

import { status } from "../src/index.js";

// Placeholder. Replaced as features land per `docs/specs/`.
describe("agent placeholder", () => {
  it("declares the awaiting-spec status sentinel", () => {
    expect(status).toBe("awaiting-spec");
  });
});
