/**
 * Prompt file loader (architecture.md D-8).
 *
 * packages/agent/prompts/*.md 를 frontmatter + body로 파싱.
 * frontmatter → generateObject({ model, temperature, system, schema }) 메타.
 * body → Handlebars 변수 치환 ({{intent.objective}} 등).
 *
 * [비할당] 팀원이 매일 만지는 토스 단위.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import matter from "gray-matter";
import Handlebars from "handlebars";
import { z } from "zod";

const PromptMetadataSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().int().positive().optional(),
  schema: z.string().min(1).optional(),
  variables: z.array(z.string()).default([]),
  owner: z.string().min(1),
  updated: z.union([z.string(), z.date()]).transform((value) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : value,
  ),
});

export interface PromptMetadata {
  id: string;
  version: string;
  model: string;
  temperature: number;
  max_tokens?: number;
  schema?: string;
  variables: string[];
  owner: string;
  updated: string;
}

export interface LoadedPrompt {
  metadata: PromptMetadata;
  rawBody: string;
  render(vars: Record<string, unknown>): string;
}

export interface PromptLoader {
  load(id: string): Promise<LoadedPrompt>;
  reload?(): Promise<void>;
}

export interface FsPromptLoaderOptions {
  promptsDir: string;
  hotReload?: boolean;
}

export function createFsPromptLoader(
  opts: FsPromptLoaderOptions,
): PromptLoader {
  const promptsDir = resolve(opts.promptsDir);
  const cache = new Map<string, LoadedPrompt>();

  async function load(id: string): Promise<LoadedPrompt> {
    if (!opts.hotReload) {
      const cached = cache.get(id);
      if (cached !== undefined) {
        return cached;
      }
    }

    const prompt = await readPrompt(promptsDir, id);
    cache.set(id, prompt);
    return prompt;
  }

  return {
    load,
    async reload() {
      cache.clear();
    },
  };
}

async function readPrompt(promptsDir: string, id: string): Promise<LoadedPrompt> {
  const path = resolve(promptsDir, `${id}.md`);
  const file = await readFile(path, "utf8");
  const parsed = matter(file);
  const metadata = PromptMetadataSchema.parse(parsed.data);
  if (metadata.id !== id) {
    throw new Error(`Prompt ${path} has id=${metadata.id}, expected ${id}`);
  }

  const template = Handlebars.compile(parsed.content, {
    noEscape: true,
    strict: false,
  });

  return {
    metadata,
    rawBody: parsed.content,
    render(vars) {
      return template(vars);
    },
  };
}
