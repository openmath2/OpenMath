/** SSE adapter (D-6). Forwards ProgressEvent from workflow generator into Hono streamSSE. */

import type { SSEStreamingApi } from "hono/streaming";

import type { ProgressEvent } from "../../schemas/index.js";
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
