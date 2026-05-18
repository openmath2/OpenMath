/** SSE adapter (D-6). Forwards ProgressEvent from workflow generator into Hono streamSSE. */

import type { SSEStreamingApi } from "hono/streaming";

import type { ProgressEvent } from "../../schemas/index.js";

export async function pipeProgressToSse(
  _stream: SSEStreamingApi,
  _events: AsyncGenerator<ProgressEvent, unknown, void>,
): Promise<void> {
  throw new Error("pipeProgressToSse: not implemented yet");
}
