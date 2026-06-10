import { describe, expect, it } from "vitest";
import { verificationStorageKey } from "../lib/verification-storage-key";

describe("verificationStorageKey", () => {
  it("joins fields with | for middle grade 3 with sourceItemId", () => {
    expect(
      verificationStorageKey({
        grade: 3,
        schoolLevel: "middle",
        topic: "9수02-09",
        topicName: "이차방정식",
        mode: "structural",
        sourceItemId: "item-abc-123",
      }),
    ).toBe(
      "openmath:verification-result|3|middle|9수02-09|이차방정식|structural|item-abc-123",
    );
  });

  it("renders null grade as empty slot (Array.prototype.join semantics)", () => {
    expect(
      verificationStorageKey({
        grade: null,
        schoolLevel: "high",
        topic: "10공수01-04",
        topicName: "복소수와 이차방정식",
        mode: "conceptual",
        sourceItemId: "high-1",
      }),
    ).toBe(
      "openmath:verification-result||high|10공수01-04|복소수와 이차방정식|conceptual|high-1",
    );
  });

  it("produces the same key for the same inputs (deterministic)", () => {
    const args = {
      grade: 1 as const,
      schoolLevel: "middle" as const,
      topic: "9수02-03",
      topicName: "일차방정식",
      mode: "structural" as const,
      sourceItemId: "x",
    };
    expect(verificationStorageKey(args)).toBe(verificationStorageKey(args));
  });

  it("differs when sourceItemId changes (writer vs reader consistency)", () => {
    const base = {
      grade: 2 as const,
      schoolLevel: "middle" as const,
      topic: "9수02-07",
      topicName: "연립일차방정식",
      mode: "structural" as const,
    };
    expect(
      verificationStorageKey({ ...base, sourceItemId: "a" }),
    ).not.toBe(verificationStorageKey({ ...base, sourceItemId: "b" }));
  });

  it("differs when mode toggles structural ↔ conceptual", () => {
    const base = {
      grade: 3 as const,
      schoolLevel: "middle" as const,
      topic: "9수03-04",
      topicName: "이차함수와 그래프",
      sourceItemId: "x-1",
    };
    expect(
      verificationStorageKey({ ...base, mode: "structural" }),
    ).not.toBe(verificationStorageKey({ ...base, mode: "conceptual" }));
  });

  it("starts with the openmath:verification-result namespace prefix", () => {
    const key = verificationStorageKey({
      grade: 1,
      schoolLevel: "middle",
      topic: "9수01-01",
      topicName: "소인수분해",
      mode: "structural",
      sourceItemId: "src-1",
    });
    expect(key.startsWith("openmath:verification-result|")).toBe(true);
  });
});
