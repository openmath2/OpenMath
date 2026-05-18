/**
 * LLM provider factory (architecture.md D-4).
 *
 * Vercel AI SDK `LanguageModel` 인스턴스 생성. agent 안에선 이 factory가
 * 반환한 모델만 사용 → provider 교체 (OpenAI / CLIProxyAPI / Claude) 가
 * 단일 지점.
 */

import type { LanguageModel } from "ai";

export type LlmProviderKind =
  | "openai"
  | "openai-compatible"
  | "anthropic-via-compatible";

export interface LlmProviderConfig {
  kind: LlmProviderKind;
  modelId: string;
  baseUrl?: string;
  apiKey?: string;
}

export function resolveLanguageModel(_config: LlmProviderConfig): LanguageModel {
  throw new Error("resolveLanguageModel: not implemented yet");
}
