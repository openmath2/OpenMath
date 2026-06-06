/**
 * Math Engine HTTP client — `packages/math-engine` 의 5개 SymPy 엔드포인트.
 *
 * `architecture.md` D-1: 모든 결정론 검증은 이 client로만.
 * `architecture.md` D-2: HTTP/JSON 동기 요청-응답.
 * 디스커버리: 환경변수 MATH_ENGINE_URL (현재 하드코딩, Q-7 closure 후 조정).
 */

import { toSympyInput } from "./sympy-input.js";

export interface SolveRequest {
  equation: string;
  variable?: string;
}
export interface SolveResponse {
  solutions: string[];
}

export interface VerifyRequest {
  expr1: string;
  expr2: string;
}
export interface VerifyResponse {
  equivalent: boolean;
  diff: string;
}

export interface SimplifyRequest {
  expr: string;
}
export interface SimplifyResponse {
  simplified: string;
}

export interface DifferentiateRequest {
  expr: string;
  variable?: string;
}
export interface DifferentiateResponse {
  derivative: string;
}

export interface LimitRequest {
  expr: string;
  variable?: string;
  point: string;
}
export interface LimitResponse {
  limit: string;
}

export interface HealthResponse {
  status: "ok";
  engine: "sympy";
}

export interface MathEngineClient {
  health(): Promise<HealthResponse>;
  solve(req: SolveRequest): Promise<SolveResponse>;
  verify(req: VerifyRequest): Promise<VerifyResponse>;
  simplify(req: SimplifyRequest): Promise<SimplifyResponse>;
  differentiate(req: DifferentiateRequest): Promise<DifferentiateResponse>;
  limit(req: LimitRequest): Promise<LimitResponse>;
}

export interface MathEngineClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  retry?: { attempts: number; backoffMs: number };
  allowedHosts?: readonly string[];
}

export function createMathEngineClient(
  opts: MathEngineClientOptions,
): MathEngineClient {
  const baseUrl = validateBaseUrl(opts.baseUrl, opts.allowedHosts).replace(/\/$/, "");
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const retry = opts.retry ?? { attempts: 1, backoffMs: 0 };

  async function request<T>(
    path: string,
    init: RequestInit,
    parse: (value: unknown) => T,
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= retry.attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${baseUrl}${path}`, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(
            `math-engine ${path} failed (${res.status}): ${body || res.statusText}`,
          );
        }
        return parse(await res.json());
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < retry.attempts) {
          await delay(retry.backoffMs * attempt);
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error(`math-engine ${path} failed`);
  }

  function post<T>(
    path: string,
    body: unknown,
    parse: (value: unknown) => T,
  ): Promise<T> {
    return request(path, { method: "POST", body: JSON.stringify(body) }, parse);
  }

  return {
    health: () => request("/health", { method: "GET" }, parseHealthResponse),
    solve: (req) =>
      post("/solve", { ...req, equation: toSympyInput(req.equation) }, parseSolveResponse),
    verify: (req) =>
      post(
        "/verify",
        { expr1: toSympyInput(req.expr1), expr2: toSympyInput(req.expr2) },
        parseVerifyResponse,
      ),
    simplify: (req) =>
      post("/simplify", { expr: toSympyInput(req.expr) }, parseSimplifyResponse),
    differentiate: (req) =>
      post(
        "/differentiate",
        { ...req, expr: toSympyInput(req.expr) },
        parseDifferentiateResponse,
      ),
    limit: (req) => post("/limit", req, parseLimitResponse),
  };
}

function validateBaseUrl(raw: string, allowedHosts?: readonly string[]): string {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`math-engine baseUrl must use http or https (got ${url.protocol})`);
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error(`math-engine baseUrl host is blocked: ${url.hostname}`);
  }
  if (allowedHosts !== undefined && !allowedHosts.includes(url.hostname)) {
    throw new Error(`math-engine baseUrl host is not allowed: ${url.hostname}`);
  }
  return url.toString();
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "169.254.169.254" || host === "0.0.0.0" || host === "metadata.google.internal";
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("math-engine response must be an object");
  }
  const record: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    record[key] = field;
  }
  return record;
}

function readString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string") {
    throw new Error(`math-engine response field ${key} must be a string`);
  }
  return field;
}

function readBoolean(value: Record<string, unknown>, key: string): boolean {
  const field = value[key];
  if (typeof field !== "boolean") {
    throw new Error(`math-engine response field ${key} must be a boolean`);
  }
  return field;
}

function readStringArray(value: Record<string, unknown>, key: string): string[] {
  const field = value[key];
  if (!Array.isArray(field) || !field.every((item) => typeof item === "string")) {
    throw new Error(`math-engine response field ${key} must be string[]`);
  }
  return field;
}

function parseHealthResponse(value: unknown): HealthResponse {
  const obj = asObject(value);
  const status = readString(obj, "status");
  const engine = readString(obj, "engine");
  if (status !== "ok" || engine !== "sympy") {
    throw new Error("math-engine health response has unexpected values");
  }
  return { status, engine };
}

function parseSolveResponse(value: unknown): SolveResponse {
  const obj = asObject(value);
  return { solutions: readStringArray(obj, "solutions") };
}

function parseVerifyResponse(value: unknown): VerifyResponse {
  const obj = asObject(value);
  return {
    equivalent: readBoolean(obj, "equivalent"),
    diff: readString(obj, "diff"),
  };
}

function parseSimplifyResponse(value: unknown): SimplifyResponse {
  const obj = asObject(value);
  return { simplified: readString(obj, "simplified") };
}

function parseDifferentiateResponse(value: unknown): DifferentiateResponse {
  const obj = asObject(value);
  return { derivative: readString(obj, "derivative") };
}

function parseLimitResponse(value: unknown): LimitResponse {
  const obj = asObject(value);
  return { limit: readString(obj, "limit") };
}
