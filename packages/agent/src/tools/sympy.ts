import { tool } from "@openai/agents";
import { z } from "zod";

const MATH_ENGINE_URL = process.env.MATH_ENGINE_URL || "http://localhost:8000";

async function callMathEngine<T>(endpoint: string, body: object): Promise<T> {
  const response = await fetch(`${MATH_ENGINE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Math engine error: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export const sympySolve = tool({
  name: "sympy_solve",
  description:
    "방정식을 풀어 해를 구합니다. 예: 'x**2 - 4 = 0' → [-2, 2]",
  parameters: z.object({
    equation: z.string().describe("풀어야 할 방정식 (예: x**2 - 4 = 0)"),
    variable: z.string().default("x").describe("미지수 (기본값: x)"),
  }),
  execute: async ({ equation, variable }) => {
    const result = await callMathEngine<{ solutions: string[] }>("/solve", {
      equation,
      variable,
    });
    return JSON.stringify(result.solutions);
  },
});

export const sympyVerify = tool({
  name: "sympy_verify",
  description:
    "두 수식이 동치인지 검증합니다. 예: '(x+1)**2' vs 'x**2 + 2*x + 1' → true",
  parameters: z.object({
    expr1: z.string().describe("첫 번째 수식"),
    expr2: z.string().describe("두 번째 수식"),
  }),
  execute: async ({ expr1, expr2 }) => {
    const result = await callMathEngine<{ equivalent: boolean; diff: string }>(
      "/verify",
      { expr1, expr2 }
    );
    return result.equivalent ? "VERIFIED" : `FAILED: diff = ${result.diff}`;
  },
});

export const sympySimplify = tool({
  name: "sympy_simplify",
  description: "수식을 단순화합니다. 예: '(x+1)**2' → 'x**2 + 2*x + 1'",
  parameters: z.object({
    expr: z.string().describe("단순화할 수식"),
  }),
  execute: async ({ expr }) => {
    const result = await callMathEngine<{ simplified: string }>("/simplify", {
      expr,
    });
    return result.simplified;
  },
});

export const sympyDifferentiate = tool({
  name: "sympy_differentiate",
  description: "함수를 미분합니다. 예: 'x**2 + 3*x' → '2*x + 3'",
  parameters: z.object({
    expr: z.string().describe("미분할 함수"),
    variable: z.string().default("x").describe("미분 변수"),
  }),
  execute: async ({ expr, variable }) => {
    const result = await callMathEngine<{ derivative: string }>(
      "/differentiate",
      { expr, variable }
    );
    return result.derivative;
  },
});

export const sympyLimit = tool({
  name: "sympy_limit",
  description: "극한값을 계산합니다. 예: 'sin(x)/x' as x→0 → 1",
  parameters: z.object({
    expr: z.string().describe("극한을 구할 함수"),
    variable: z.string().default("x").describe("변수"),
    point: z.string().describe("극한점 (예: '0', 'oo' for infinity)"),
  }),
  execute: async ({ expr, variable, point }) => {
    const result = await callMathEngine<{ limit: string }>("/limit", {
      expr,
      variable,
      point,
    });
    return result.limit;
  },
});
