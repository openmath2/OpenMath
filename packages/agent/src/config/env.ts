/** Environment variable validation. */

import { z } from "zod";

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  MATH_ENGINE_URL: z.string().url().default("http://localhost:8000"),

  LLM_PROVIDER: z
    .enum(["openai", "openai-compatible", "anthropic-via-compatible", "cliproxy"])
    .default("openai-compatible"),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_API_KEY: z.string().min(1).optional(),
  LLM_MODEL: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  CLIPROXY_BASE_URL: z.string().url().optional(),
  CLIPROXY_API_KEY: z.string().min(1).optional(),
  CLIPROXY_MODEL: z.string().min(1).optional(),

  PROMPTS_DIR: z.string().default("./prompts"),
  STRATEGIES_DIR: z.string().default("./data/achievement-standards"),
  CORPUS_JSONL: z.string().optional(),

  MAX_RETRIES: z.coerce.number().int().min(1).max(10).default(3),
  PER_STEP_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  return parsed.data;
}
