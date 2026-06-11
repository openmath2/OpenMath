/**
 * Run trace writer — 워크플로우 런 단위 JSONL 관측 로그 (DX).
 *
 * `TRACE_DIR/run-<date>-<runId>.jsonl` 에 ProgressEvent 전문(게이트 evidence 포함)을,
 * `TRACE_DIR/llm.jsonl` 에 LLM 호출 지연/토큰을 append한다.
 *
 * 트레이스는 절대 파이프라인을 깨면 안 된다 — 모든 실패는 warn 후 무시.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface RunTraceWriter {
  /** fileKey: 확장자 없는 파일 이름 (`run-...` 또는 `llm`). record는 JSON 직렬화 가능해야 한다. */
  append(fileKey: string, record: Record<string, unknown>): Promise<void>;
}

export interface FsRunTraceWriterOptions {
  dir: string;
  enabled: boolean;
}

export function createFsRunTraceWriter(opts: FsRunTraceWriterOptions): RunTraceWriter {
  let dirReady: Promise<void> | undefined;

  function ensureDir(): Promise<void> {
    dirReady ??= mkdir(opts.dir, { recursive: true }).then(() => undefined);
    return dirReady;
  }

  return {
    async append(fileKey, record) {
      if (!opts.enabled) return;
      try {
        await ensureDir();
        const line = JSON.stringify({ ts: new Date().toISOString(), ...record });
        await appendFile(join(opts.dir, `${fileKey}.jsonl`), `${line}\n`, "utf8");
      } catch (err) {
        console.warn(
          `[trace] write failed (${fileKey}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  };
}

export const NOOP_TRACE_WRITER: RunTraceWriter = {
  async append() {
    /* tracing disabled */
  },
};
