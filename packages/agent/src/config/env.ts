/** Environment variable validation. */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(31415),

  MATH_ENGINE_URL: z.string().url().default("http://localhost:16180"),

  LLM_PROVIDER: z
    .enum(["openai", "openai-compatible", "anthropic-via-compatible", "cliproxy"])
    .default("openai-compatible"),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_API_KEY: z.string().min(1).optional(),
  LLM_MODEL: z.string().min(1).optional(),
  /** Optional override for the independent re-solve agent (D-5 ReSolveSpecialist).
   *  When set to a model id different from `LLM_MODEL`, the solver agent is built
   *  with a separate LanguageModel instance to decorrelate errors with generation.
   *  When unset, the solver shares the generator's resolved model. */
  SOLVER_MODEL: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  CLIPROXY_BASE_URL: z.string().url().optional(),
  CLIPROXY_API_KEY: z.string().min(1).optional(),
  CLIPROXY_MODEL: z.string().min(1).optional(),

  PROMPTS_DIR: z.string().default("./prompts"),
  STRATEGIES_DIR: z.string().default("./data/achievement-standards"),
  CORPUS_JSONL: z.string().optional(),

  MAX_RETRIES: z.coerce.number().int().min(1).max(10).default(3),
  /** 60s, not 30s: one LLM step (intent) can take ~36s on a reasoning model;
   *  the generate step runs several LLM calls and gets a larger budget in the
   *  workflow. Below ~45s, last-resort/off generation times out and fails. */
  PER_STEP_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60000),

  /** `first` = template short-circuits LLM when refs exist.
   *  `off` = always go through LLM generator path; never substitute template.
   *  `last-resort` = LLM first; substitute the deterministic template only when the
   *  final verification verdict is `rejected` (transparent fallback, D-11). */
  DETERMINISTIC_FALLBACK: z
    .enum(["off", "last-resort", "first"])
    .default("first"),

  /** Per-run JSONL observability traces (ProgressEvent 전문 + LLM call 지연/토큰).
   *  Files land in TRACE_DIR: run-<date>-<id>.jsonl, llm.jsonl. */
  TRACE_ENABLED: z.enum(["true", "false"]).default("true"),
  TRACE_DIR: z.string().default("./runs"),
});

export type Env = z.infer<typeof EnvSchema>;

export type DeterministicFallbackMode = Env["DETERMINISTIC_FALLBACK"];

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse({ ...readDotenvFiles(), ...process.env });
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  return parsed.data;
}

function readDotenvFiles(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const path of dotenvCandidates()) {
    if (!existsSync(path)) continue;
    Object.assign(values, parseDotenv(readFileSync(path, "utf8")));
  }
  return values;
}

function dotenvCandidates(): readonly string[] {
  const cwd = process.cwd();
  return [...new Set([resolve(cwd, ".env"), resolve(cwd, "packages/agent/.env")])];
}

function parseDotenv(source: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const body = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const separator = body.indexOf("=");
    if (separator <= 0) continue;
    const key = body.slice(0, separator).trim();
    const rawValue = body.slice(separator + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) continue;
    values[key] = unquote(rawValue);
  }
  return values;
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replaceAll("\\n", "\n").replaceAll('\\"', '"');
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}
