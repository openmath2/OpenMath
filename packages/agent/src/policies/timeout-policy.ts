/** Per-step timeout wrapper. Returns a GateResult with failure_detail on timeout. */

export interface TimeoutOptions {
  ms: number;
  label: string;
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  opts: TimeoutOptions,
): Promise<T> {
  if (!Number.isInteger(opts.ms) || opts.ms <= 0) {
    throw new Error(`timeout ms must be a positive integer (got ${opts.ms})`);
  }
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${opts.label} timed out after ${opts.ms}ms`));
        }, opts.ms);
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
