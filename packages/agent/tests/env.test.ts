import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadEnv } from "../src/config/env.js";

const ENV_KEYS = [
  "CLIPROXY_BASE_URL",
  "CLIPROXY_API_KEY",
  "CLIPROXY_MODEL",
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
] as const;

const savedEnv = new Map<string, string | undefined>();
let originalCwd = "";
let tempRoot = "";

describe("loadEnv", () => {
  beforeEach(() => {
    originalCwd = process.cwd();
    tempRoot = mkdtempSync(join(tmpdir(), "openmath-env-"));
    for (const key of ENV_KEYS) {
      savedEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempRoot, { recursive: true, force: true });
    for (const key of ENV_KEYS) {
      const value = savedEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    savedEnv.clear();
  });

  it("loads package env when launched from the monorepo root", () => {
    const agentDir = join(tempRoot, "packages", "agent");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(
      join(agentDir, ".env"),
      [
        "LLM_PROVIDER=cliproxy",
        "CLIPROXY_BASE_URL=http://localhost:8317/v1",
        "CLIPROXY_API_KEY=test-key",
        "CLIPROXY_MODEL=test-model",
      ].join("\n"),
    );
    process.chdir(tempRoot);

    const env = loadEnv();

    expect(env.CLIPROXY_BASE_URL).toBe("http://localhost:8317/v1");
    expect(env.CLIPROXY_API_KEY).toBe("test-key");
    expect(env.CLIPROXY_MODEL).toBe("test-model");
  });
});
