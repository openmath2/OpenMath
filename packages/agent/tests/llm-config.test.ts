import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDefaultModel, loadLLMConfig } from "../src/config/llm.js";

const ORIGINAL_ENV = { ...process.env };

describe("loadLLMConfig", () => {
  beforeEach(() => {
    delete process.env.LLM_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.CLIPROXY_BASE_URL;
    delete process.env.CLIPROXY_API_KEY;
    delete process.env.CLIPROXY_MODEL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to openai provider", () => {
    process.env.OPENAI_API_KEY = "sk-test";

    const config = loadLLMConfig();

    expect(config.provider).toBe("openai");
    expect(config.apiKey).toBe("sk-test");
    expect(config.defaultModel).toBe("gpt-4o");
    expect(config.baseURL).toBeUndefined();
  });

  it("respects OPENAI_MODEL override", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_MODEL = "gpt-4o-mini";

    expect(loadLLMConfig().defaultModel).toBe("gpt-4o-mini");
    expect(getDefaultModel()).toBe("gpt-4o-mini");
  });

  it("switches to cliproxy provider", () => {
    process.env.LLM_PROVIDER = "cliproxy";
    process.env.CLIPROXY_BASE_URL = "http://localhost:9999/v1";
    process.env.CLIPROXY_API_KEY = "proxy-key";
    process.env.CLIPROXY_MODEL = "claude-sonnet-4.5";

    const config = loadLLMConfig();

    expect(config.provider).toBe("cliproxy");
    expect(config.baseURL).toBe("http://localhost:9999/v1");
    expect(config.apiKey).toBe("proxy-key");
    expect(config.defaultModel).toBe("claude-sonnet-4.5");
  });

  it("falls back to default cliproxy URL when not specified", () => {
    process.env.LLM_PROVIDER = "cliproxy";

    const config = loadLLMConfig();

    expect(config.baseURL).toBe("http://localhost:8080/v1");
    expect(config.apiKey).toBe("dummy-key");
  });
});
