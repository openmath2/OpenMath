import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("sympy tools (HTTP integration)", () => {
  let originalFetch: typeof globalThis.fetch;
  let lastRequest: { url: string; body: unknown } | null = null;

  beforeAll(() => {
    process.env.MATH_ENGINE_URL = "http://math-engine.test";
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    lastRequest = null;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...ORIGINAL_ENV };
  });

  function mockResponse(body: unknown, ok = true) {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      lastRequest = {
        url,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      };
      return new Response(JSON.stringify(body), {
        status: ok ? 200 : 500,
        statusText: ok ? "OK" : "Internal Server Error",
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;
  }

  it("sympy_solve calls /solve endpoint and returns solutions JSON", async () => {
    mockResponse({ solutions: ["2", "3"] });

    const { sympySolve } = await import("../src/tools/sympy.js");
    const result = await sympySolve.invoke(
      {} as never,
      JSON.stringify({ equation: "x**2 - 5*x + 6 = 0", variable: "x" }),
    );

    expect(lastRequest?.url).toBe("http://math-engine.test/solve");
    expect(lastRequest?.body).toEqual({
      equation: "x**2 - 5*x + 6 = 0",
      variable: "x",
    });
    expect(JSON.parse(result as string)).toEqual(["2", "3"]);
  });

  it("sympy_verify returns VERIFIED on equivalent expressions", async () => {
    mockResponse({ equivalent: true, diff: "0" });

    const { sympyVerify } = await import("../src/tools/sympy.js");
    const result = await sympyVerify.invoke(
      {} as never,
      JSON.stringify({ expr1: "(x+1)**2", expr2: "x**2 + 2*x + 1" }),
    );

    expect(result).toBe("VERIFIED");
  });

  it("sympy_verify returns FAILED with diff on non-equivalent expressions", async () => {
    mockResponse({ equivalent: false, diff: "x**2 - x**3" });

    const { sympyVerify } = await import("../src/tools/sympy.js");
    const result = await sympyVerify.invoke(
      {} as never,
      JSON.stringify({ expr1: "x**2", expr2: "x**3" }),
    );

    expect(result).toContain("FAILED");
    expect(result).toContain("x**2 - x**3");
  });

  it("sympy_simplify returns simplified expression", async () => {
    mockResponse({ simplified: "2*x + 1" });

    const { sympySimplify } = await import("../src/tools/sympy.js");
    const result = await sympySimplify.invoke(
      {} as never,
      JSON.stringify({ expr: "(x+1)**2 - x**2" }),
    );

    expect(result).toBe("2*x + 1");
  });

  it("sympy_differentiate returns derivative", async () => {
    mockResponse({ derivative: "2*x + 3" });

    const { sympyDifferentiate } = await import("../src/tools/sympy.js");
    const result = await sympyDifferentiate.invoke(
      {} as never,
      JSON.stringify({ expr: "x**2 + 3*x", variable: "x" }),
    );

    expect(result).toBe("2*x + 3");
  });

  it("sympy_limit returns limit value", async () => {
    mockResponse({ limit: "1" });

    const { sympyLimit } = await import("../src/tools/sympy.js");
    const result = await sympyLimit.invoke(
      {} as never,
      JSON.stringify({ expr: "sin(x)/x", variable: "x", point: "0" }),
    );

    expect(lastRequest?.body).toEqual({
      expr: "sin(x)/x",
      variable: "x",
      point: "0",
    });
    expect(result).toBe("1");
  });

  it("surfaces math engine errors to the agent runtime", async () => {
    mockResponse({}, false);

    const { sympySolve } = await import("../src/tools/sympy.js");
    const result = await sympySolve.invoke(
      {} as never,
      JSON.stringify({ equation: "x = 0", variable: "x" }),
    );

    expect(String(result)).toMatch(/Math engine error/);
  });
});
