/** Per-step timeout wrapper. `fn`'s `AbortSignal` is aborted when the timeout
 *  fires, so wrapped LLM calls are cancelled rather than left running to the
 *  wall clock. Zero-arg callers that ignore the signal stay assignable. */

export interface TimeoutOptions {
  ms: number;
  label: string;
}

export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: TimeoutOptions,
): Promise<T> {
  if (!Number.isInteger(opts.ms) || opts.ms <= 0) {
    throw new Error(`timeout ms must be a positive integer (got ${opts.ms})`);
  }
  const controller = new AbortController();
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      fn(controller.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`${opts.label} timed out after ${opts.ms}ms`);
          controller.abort(error);
          reject(error);
        }, opts.ms);
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
