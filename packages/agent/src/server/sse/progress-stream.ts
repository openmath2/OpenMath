/** SSE adapter (D-6). Forwards ProgressEvent from workflow generators into Hono streamSSE.
 *
 *  관측성: 모든 런(드라이버 + 백그라운드)의 이벤트를 run 단위 JSONL 트레이스와
 *  stdout 한 줄 내레이션으로 남긴다. 트레이스 실패는 스트림에 영향을 주지 않는다. */

import { randomUUID } from "node:crypto";

import type { SSEStreamingApi } from "hono/streaming";

import type { ProgressEvent, ResultEvent, WireRunsEvent } from "../../schemas/index.js";
import type { RunTraceWriter } from "../../tools/run-trace.js";
import { toWireSseEvent, toWireStepEvent } from "./wire-adapter.js";

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

export interface ParallelProgressOptions {
  trace?: RunTraceWriter;
  /** 트레이스 run_start 레코드에 남길 원본 요청. */
  request?: unknown;
}

/** Runs N workflows for one request to produce `count` problems.
 *
 *  - 첫 번째 런(driver)의 step/preview/attempt 이벤트가 사용자 스텝바를 움직인다.
 *    나머지 런은 백그라운드에서 트레이스만 남기며 돌고, 결과는 하나의 result로 합쳐진다.
 *  - 각 런이 끝날 때마다 `runs` 이벤트({completed, total})로 집계를 알린다 (count > 1일 때).
 *  - driver의 error 이벤트는 즉시 흘리지 않고 버퍼링한다: 다른 런이 문항을 만들어내면
 *    에러 대신 result를 보낸다. 모든 런이 빈손일 때만 에러를 보낸다. */
export async function pipeParallelProgressToSse(
  stream: SSEStreamingApi,
  runs: AsyncGenerator<ProgressEvent, unknown, void>[],
  options?: ParallelProgressOptions,
): Promise<void> {
  const total = runs.length;
  if (total === 0) return;

  const traced = runs.map((run, index) =>
    withRunTrace(run, {
      trace: options?.trace,
      request: options?.request,
      runLabel: `${index + 1}/${total}`,
    }),
  );
  const [driver, ...others] = traced;
  if (driver === undefined) return;

  const writeWire = (event: ProgressEvent): Promise<void> => {
    const wire = toWireSseEvent(event);
    return stream.writeSSE({ event: wire.event, data: JSON.stringify(wire.data) });
  };

  const collected: ResultEvent[] = [];
  const failures: string[] = [];
  const bufferedErrors: Array<Extract<ProgressEvent, { type: "error" }>> = [];

  let completedRuns = 0;
  const writeRunsEvent = async (): Promise<void> => {
    completedRuns += 1;
    if (total <= 1) return;
    const data: WireRunsEvent = { completed: completedRuns, total };
    await stream.writeSSE({ event: "runs", data: JSON.stringify(data) });
  };

  const drained = others.map(async (run) => {
    try {
      for await (const event of run) {
        if (event.type === "result") collected.push(event);
      }
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err));
    }
    await writeRunsEvent();
  });

  try {
    for await (const event of driver) {
      if (event.type === "result") {
        collected.push(event);
        continue;
      }
      if (event.type === "error") {
        bufferedErrors.push(event);
        continue;
      }
      await writeWire(event);
    }
  } catch (err) {
    failures.push(err instanceof Error ? err.message : String(err));
  }
  await writeRunsEvent();

  await Promise.all(drained);

  const candidates = collected.flatMap((result) => result.candidates);
  if (candidates.length > 0) {
    await writeWire({ type: "result", candidates, timestamp: new Date().toISOString() });
    return;
  }
  const bufferedError = bufferedErrors[0];
  if (bufferedError !== undefined) {
    await writeWire(bufferedError);
    return;
  }
  await writeWire({
    type: "error",
    stage: "orchestrator",
    code: "all_generations_failed",
    message: failures[0] ?? "No problems were generated.",
    recoverable: false,
    timestamp: new Date().toISOString(),
  });
}

interface RunTraceContext {
  trace?: RunTraceWriter;
  request?: unknown;
  runLabel: string;
}

/** 런 하나의 이벤트를 그대로 통과시키며 JSONL 트레이스 + stdout 내레이션을 남기는 tee. */
async function* withRunTrace(
  run: AsyncGenerator<ProgressEvent, unknown, void>,
  ctx: RunTraceContext,
): AsyncGenerator<ProgressEvent, void, void> {
  const runId = randomUUID();
  const shortId = runId.slice(0, 8);
  const fileKey = `run-${new Date().toISOString().slice(0, 10)}-${runId}`;
  let seq = 0;

  await ctx.trace?.append(fileKey, {
    run_id: runId,
    seq,
    event: { type: "run_start", run: ctx.runLabel },
    ...(ctx.request === undefined ? {} : { request: ctx.request }),
  });

  try {
    for await (const event of run) {
      seq += 1;
      await ctx.trace?.append(fileKey, { run_id: runId, seq, event });
      narrate(shortId, ctx.runLabel, event);
      yield event;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    seq += 1;
    await ctx.trace?.append(fileKey, {
      run_id: runId,
      seq,
      event: { type: "exception", message },
    });
    console.warn(`[run ${shortId} ${ctx.runLabel}] ✗ exception: ${message}`);
    throw err;
  }
}

const STEP_STATUS_GLYPH: Record<string, string> = {
  completed: "✓",
  failed: "✗",
  unverified: "△",
};

function narrate(shortId: string, runLabel: string, event: ProgressEvent): void {
  const prefix = `[run ${shortId} ${runLabel}]`;
  if (event.type === "step") {
    if (event.status === "start") return; // done 라인만 — 로그를 조용하게 유지
    const wire = toWireStepEvent(event);
    const glyph = STEP_STATUS_GLYPH[wire.status] ?? "·";
    const summary = wire.summary === null || wire.summary === undefined ? "" : ` — ${wire.summary}`;
    console.log(`${prefix} ${wire.index}/6 ${wire.name} ${glyph}${summary}`);
    return;
  }
  if (event.type === "retry") {
    console.log(`${prefix} ↻ 시도 ${event.attempt}/${event.max_attempts}: ${event.reason}`);
    return;
  }
  if (event.type === "preview") {
    console.log(`${prefix} ◇ 후보: ${truncate(event.latex, 80)}`);
    return;
  }
  if (event.type === "result") {
    const verdicts = event.candidates.map((candidate) => candidate.verification.overall).join(", ");
    console.log(`${prefix} ● 결과 ${event.candidates.length}문항 (${verdicts})`);
    return;
  }
  console.log(`${prefix} ✗ error ${event.stage}/${event.code}: ${event.message}`);
}

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
}
