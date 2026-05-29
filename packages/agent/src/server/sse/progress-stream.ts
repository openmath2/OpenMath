/** SSE adapter (D-6). Forwards ProgressEvent from workflow generator into Hono streamSSE. */

import type { SSEStreamingApi } from "hono/streaming";

import type { ProgressEvent, StepName } from "../../schemas/index.js";

export async function pipeProgressToSse(
  stream: SSEStreamingApi,
  events: AsyncGenerator<ProgressEvent, unknown, void>,
): Promise<void> {
  for await (const event of events) {
    await stream.writeSSE(toWireEvent(event));
  }
}

function toWireEvent(event: ProgressEvent): {
  event: string;
  data: string;
} {
  switch (event.type) {
    case "step":
      return {
        event: "step",
        data: JSON.stringify({
          index: stepIndex(event.step),
          name: event.step,
          status: event.status === "start" ? "started" : "completed",
          summary: stepSummary(event),
          raw: event,
        }),
      };
    case "result":
      return {
        event: "result",
        data: JSON.stringify(event.candidates),
      };
    case "error":
      return {
        event: "error",
        data: JSON.stringify({
          stage: event.stage,
          message: event.message,
          code: event.code,
          recoverable: event.recoverable,
        }),
      };
    case "retry":
      return {
        event: "retry",
        data: JSON.stringify(event),
      };
  }
}

function stepIndex(step: StepName): number {
  switch (step) {
    case "rag":
      return 1;
    case "intent":
      return 2;
    case "generate":
      return 3;
    case "sympy_verify":
      return 4;
    case "re_solve":
      return 5;
    case "objective_map":
      return 6;
  }
}

function stepSummary(event: ProgressEvent & { type: "step" }): string | null {
  if (event.status === "start") {
    return null;
  }

  if (event.step === "rag") {
    const data = event.data;
    if (isRecord(data) && typeof data.count === "number") {
      return `${data.count}개 참조 발견`;
    }
  }

  return "완료";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
