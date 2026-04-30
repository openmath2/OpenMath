import { describe, expect, it, vi } from "vitest";

vi.mock("../src/agents/generator.js", () => ({
  runGeneratorAgent: vi.fn(async () => [
    {
      problem: "1 + 1 = ?",
      solution: "1 + 1 = 2",
      answer: "2",
      metadata: { method: "addition", concepts: ["덧셈"], cognitiveLevel: "암기" },
    },
  ]),
}));

vi.mock("../src/agents/verifier.js", () => ({
  runVerifierAgent: vi.fn(async () => ({
    valid: true,
    errors: [],
    warnings: [],
    verifiedSteps: [{ step: "1 + 1 = 2", verified: true }],
  })),
}));

const { createApp } = await import("../src/app.js");

describe("POST /api/agent/generate", () => {
  const app = createApp();

  it("rejects invalid request body", async () => {
    const response = await app.request("/api/agent/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it("accepts valid request and returns generated problems", async () => {
    const response = await app.request("/api/agent/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolLevel: "elementary",
        grade: 1,
        topic: "덧셈",
        difficulty: "easy",
        count: 1,
      }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].answer).toBe("2");
  });

  it("rejects out-of-range grade", async () => {
    const response = await app.request("/api/agent/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolLevel: "middle",
        grade: 99,
        topic: "이차방정식",
        difficulty: "medium",
        count: 1,
      }),
    });

    expect(response.status).toBe(400);
  });
});

describe("POST /api/agent/verify", () => {
  const app = createApp();

  it("rejects invalid request body", async () => {
    const response = await app.request("/api/agent/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem: "only problem" }),
    });

    expect(response.status).toBe(400);
  });

  it("accepts valid request and returns verification result", async () => {
    const response = await app.request("/api/agent/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        problem: "1 + 1 = ?",
        solution: "1 + 1 = 2",
        answer: "2",
      }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(true);
    expect(body.data.verifiedSteps).toHaveLength(1);
  });
});
