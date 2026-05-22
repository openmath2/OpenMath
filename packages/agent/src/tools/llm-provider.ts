/**
 * LLM provider factory (architecture.md D-4).
 *
 * Vercel AI SDK `LanguageModel` 인스턴스 생성. agent 안에선 이 factory가
 * 반환한 모델만 사용 → provider 교체 (OpenAI / CLIProxyAPI / Claude) 가
 * 단일 지점.
 */

import { createOpenAI, openai } from "@ai-sdk/openai";
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
  allowedHosts?: readonly string[];
}

export function resolveLanguageModel(config: LlmProviderConfig): LanguageModel {
  if (config.kind === "openai") {
    if (config.apiKey !== undefined || config.baseUrl !== undefined) {
      const provider = createOpenAI({
        apiKey: config.apiKey,
        baseURL:
          config.baseUrl === undefined
            ? undefined
            : validateBaseUrl(config.baseUrl, config.allowedHosts),
        compatibility: "strict",
      });
      return provider(config.modelId);
    }
    return openai(config.modelId);
  }

  const provider = createOpenAICompatible({
    name: config.kind,
    apiKey: config.apiKey,
    baseURL: validateBaseUrl(requiredBaseUrl(config), config.allowedHosts),
  });
  return provider.chatModel(config.modelId);
}

function validateBaseUrl(raw: string, allowedHosts?: readonly string[]): string {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`LLM baseUrl must use http or https (got ${url.protocol})`);
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error(`LLM baseUrl host is blocked: ${url.hostname}`);
  }
  if (allowedHosts !== undefined && !allowedHosts.includes(url.hostname)) {
    throw new Error(`LLM baseUrl host is not allowed: ${url.hostname}`);
  }
  return url.toString();
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "169.254.169.254" || host === "0.0.0.0" || host === "metadata.google.internal";
}

function requiredBaseUrl(config: LlmProviderConfig): string {
  if (config.baseUrl === undefined) {
    throw new Error(`${config.kind} requires baseUrl`);
  }
  return config.baseUrl;
}
