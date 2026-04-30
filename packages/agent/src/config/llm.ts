import { OpenAI } from "openai";
import { setDefaultOpenAIClient } from "@openai/agents";

export interface LLMConfig {
  provider: "openai" | "cliproxy";
  baseURL?: string;
  apiKey: string;
  defaultModel: string;
}

export function loadLLMConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER || "openai") as LLMConfig["provider"];

  if (provider === "cliproxy") {
    return {
      provider: "cliproxy",
      baseURL: process.env.CLIPROXY_BASE_URL || "http://localhost:8080/v1",
      apiKey: process.env.CLIPROXY_API_KEY || "dummy-key",
      defaultModel: process.env.CLIPROXY_MODEL || "gpt-4o",
    };
  }

  return {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY || "",
    defaultModel: process.env.OPENAI_MODEL || "gpt-4o",
  };
}

export function initializeLLMClient(): void {
  const config = loadLLMConfig();

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  setDefaultOpenAIClient(client);

  console.log(`LLM Provider: ${config.provider}`);
  if (config.baseURL) {
    console.log(`LLM Base URL: ${config.baseURL}`);
  }
  console.log(`Default Model: ${config.defaultModel}`);
}

export function getDefaultModel(): string {
  return loadLLMConfig().defaultModel;
}
