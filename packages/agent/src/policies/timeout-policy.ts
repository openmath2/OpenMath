/** Per-step timeout wrapper. Returns a GateResult with failure_detail on timeout. */

export interface TimeoutOptions {
  ms: number;
  label: string;
}

export async function withTimeout<T>(
  _fn: () => Promise<T>,
  _opts: TimeoutOptions,
): Promise<T> {
  throw new Error("withTimeout: not implemented yet");
}
