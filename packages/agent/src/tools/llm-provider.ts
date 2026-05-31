/**
 * LLM provider factory (architecture.md D-4).
 *
 * Vercel AI SDK `LanguageModel` 인스턴스 생성. agent 안에선 이 factory가
 * 반환한 모델만 사용 → provider 교체 (OpenAI / CLIProxyAPI / Claude) 가
 * 단일 지점.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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

export function resolveLanguageModel(config: LlmProviderConfig): LanguageModel {
  if (config.kind === "openai") {
    const provider = createOpenAI({
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
      compatibility: "strict",
    });
    return provider(config.modelId);
  }

  if (config.baseUrl === undefined) {
    throw new Error(`${config.kind} requires LLM_BASE_URL`);
  }

  const provider = createOpenAICompatible({
    name: config.kind,
    baseURL: config.baseUrl,
    apiKey: config.apiKey ?? "dummy-key",
  });
  return provider(config.modelId);
}
