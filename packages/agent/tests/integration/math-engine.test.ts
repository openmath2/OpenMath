import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ENGINE_PORT = 8765;
const ENGINE_URL = `http://localhost:${ENGINE_PORT}`;
const ENGINE_DIR = new URL("../../../math-engine", import.meta.url).pathname;
const STARTUP_TIMEOUT_MS = 15000;

let engineProcess: ChildProcess | null = null;

async function waitForReady(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      /* swallow */
    }
    await wait(200);
  }
  throw new Error(`Math engine not ready at ${url} within ${timeoutMs}ms`);
}

describe.sequential("math-engine integration (live HTTP)", () => {
  beforeAll(async () => {
    engineProcess = spawn(
      "uv",
      [
        "run",
        "uvicorn",
        "src.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        String(ENGINE_PORT),
        "--log-level",
        "warning",
      ],
      {
        cwd: ENGINE_DIR,
        stdio: "pipe",
        env: { ...process.env },
      },
    );

    process.env.MATH_ENGINE_URL = ENGINE_URL;

    await waitForReady(ENGINE_URL, STARTUP_TIMEOUT_MS);
  }, STARTUP_TIMEOUT_MS + 5000);

  afterAll(async () => {
    if (engineProcess && !engineProcess.killed) {
      engineProcess.kill("SIGTERM");
      await wait(200);
      if (!engineProcess.killed) engineProcess.kill("SIGKILL");
    }
    delete process.env.MATH_ENGINE_URL;
  });

  it("solves quadratic equation through tool layer", async () => {
    const { sympySolve } = await import("../../src/tools/sympy.js");
    const result = await sympySolve.invoke(
      {} as never,
      JSON.stringify({ equation: "x**2 - 5*x + 6 = 0", variable: "x" }),
    );

    const solutions = JSON.parse(result as string);
    expect(solutions.sort()).toEqual(["2", "3"]);
  });

  it("verifies expression equivalence through tool layer", async () => {
    const { sympyVerify } = await import("../../src/tools/sympy.js");
    const result = await sympyVerify.invoke(
      {} as never,
      JSON.stringify({ expr1: "(x+1)**2", expr2: "x**2 + 2*x + 1" }),
    );

    expect(result).toBe("VERIFIED");
  });

  it("computes limit through tool layer", async () => {
    const { sympyLimit } = await import("../../src/tools/sympy.js");
    const result = await sympyLimit.invoke(
      {} as never,
      JSON.stringify({ expr: "sin(x)/x", variable: "x", point: "0" }),
    );

    expect(result).toBe("1");
  });
});
