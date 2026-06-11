/**
 * LLM call logging middleware (DX).
 *
 * resolveLanguageModel이 만든 모델을 감싸 모든 generateObject/generateText 호출의
 * 지연·토큰·종료 사유를 stdout 한 줄 + (옵션) 트레이스 레코드로 남긴다.
 * 에이전트 코드는 전혀 몰라도 된다 — 모델 인스턴스 단일 지점에서 계측.
 */

import { wrapLanguageModel, type LanguageModel, type LanguageModelV1Middleware } from "ai";

export type LlmCallRecord = {
  type: "llm_call";
  label: string;
  duration_ms: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  finish_reason?: string;
  error?: string;
};

export function withLlmLogging(
  model: LanguageModel,
  label: string,
  onRecord?: (record: LlmCallRecord) => void,
): LanguageModel {
  const middleware: LanguageModelV1Middleware = {
    wrapGenerate: async ({ doGenerate }) => {
      const started = Date.now();
      try {
        const result = await doGenerate();
        const record: LlmCallRecord = {
          type: "llm_call",
          label,
          duration_ms: Date.now() - started,
          prompt_tokens: finiteOrUndefined(result.usage?.promptTokens),
          completion_tokens: finiteOrUndefined(result.usage?.completionTokens),
          finish_reason: result.finishReason,
        };
        console.log(
          `[llm] ${label} ${(record.duration_ms / 1000).toFixed(1)}s` +
            ` in=${record.prompt_tokens ?? "?"} out=${record.completion_tokens ?? "?"}` +
            ` (${record.finish_reason ?? "?"})`,
        );
        onRecord?.(record);
        return result;
      } catch (err) {
        const record: LlmCallRecord = {
          type: "llm_call",
          label,
          duration_ms: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
        };
        console.warn(
          `[llm] ${label} failed after ${(record.duration_ms / 1000).toFixed(1)}s: ${record.error}`,
        );
        onRecord?.(record);
        throw err;
      }
    },
  };
  return wrapLanguageModel({ model, middleware });
}

function finiteOrUndefined(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}
