/** SSE adapter (D-6). Forwards ProgressEvent from workflow generator into Hono streamSSE. */

import type { SSEStreamingApi } from "hono/streaming";

import type { ProgressEvent, ResultEvent } from "../../schemas/index.js";
import { toWireSseEvent } from "./wire-adapter.js";

export async function pipeProgressToSse(
  stream: SSEStreamingApi,
  events: AsyncGenerator<ProgressEvent, unknown, void>,
): Promise<void> {
  try {
    for await (const event of events) {
      const wire = toWireSseEvent(event);
      await stream.writeSSE({
        event: wire.event,
        data: JSON.stringify(wire.data),
      });
    }
  } catch (err) {
    const wire = toWireSseEvent({
      type: "error",
      stage: "orchestrator",
      code: "workflow_exception",
      message: `Verification workflow failed before streaming completed: ${err instanceof Error ? err.message : String(err)}`,
      recoverable: false,
      timestamp: new Date().toISOString(),
    });
    await stream.writeSSE({
      event: wire.event,
      data: JSON.stringify(wire.data),
    });
  }
}

/** Runs N workflows for one request to produce `count` problems. Only the first
 *  run's step/preview/error events drive the user-visible bar; the rest are
 *  drained silently in parallel. Their result candidates are merged into a
 *  single result event so the FE receives all problems at once. A run that
 *  fails contributes no problem rather than aborting the others. */
export async function pipeParallelProgressToSse(
  stream: SSEStreamingApi,
  runs: AsyncGenerator<ProgressEvent, unknown, void>[],
): Promise<void> {
  const [driver, ...others] = runs;
  if (driver === undefined) return;

  const writeWire = (event: ProgressEvent): Promise<void> => {
    const wire = toWireSseEvent(event);
    return stream.writeSSE({ event: wire.event, data: JSON.stringify(wire.data) });
  };

  const collected: ResultEvent[] = [];
  const failures: string[] = [];

  const drained = others.map(async (run) => {
    try {
      for await (const event of run) {
        if (event.type === "result") collected.push(event);
      }
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err));
    }
  });

  let forwardedError = false;
  try {
    for await (const event of driver) {
      if (event.type === "result") {
        collected.push(event);
        continue;
      }
      if (event.type === "error") forwardedError = true;
      await writeWire(event);
    }
  } catch (err) {
    failures.push(err instanceof Error ? err.message : String(err));
  }

  await Promise.all(drained);

  const candidates = collected.flatMap((result) => result.candidates);
  if (candidates.length > 0) {
    await writeWire({ type: "result", candidates, timestamp: new Date().toISOString() });
    return;
  }
  if (!forwardedError) {
    await writeWire({
      type: "error",
      stage: "orchestrator",
      code: "all_generations_failed",
      message: failures[0] ?? "No problems were generated.",
      recoverable: false,
      timestamp: new Date().toISOString(),
    });
  }
}
