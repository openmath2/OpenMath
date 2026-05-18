/**
 * Math Engine HTTP client — `packages/math-engine` 의 5개 SymPy 엔드포인트.
 *
 * `architecture.md` D-1: 모든 결정론 검증은 이 client로만.
 * `architecture.md` D-2: HTTP/JSON 동기 요청-응답.
 * 디스커버리: 환경변수 MATH_ENGINE_URL (현재 하드코딩, Q-7 closure 후 조정).
 */

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
}

export function createMathEngineClient(
  _opts: MathEngineClientOptions,
): MathEngineClient {
  throw new Error("createMathEngineClient: not implemented yet");
}
