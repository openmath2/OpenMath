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
import { join } from "node:path";

import matter from "gray-matter";
import Handlebars from "handlebars";
import { z } from "zod";

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
  const cache = new Map<string, LoadedPrompt>();

  async function load(id: string): Promise<LoadedPrompt> {
    assertPromptId(id);
    if (opts.hotReload !== true) {
      const cached = cache.get(id);
      if (cached !== undefined) return cached;
    }

    const filePath = join(opts.promptsDir, `${id}.md`);
    const source = await readFile(filePath, "utf8");
    const parsed = matter(source);
    const metadata = parsePromptMetadata(parsed.data, id, filePath);
    const template = Handlebars.compile(parsed.content, { noEscape: true });

    const prompt: LoadedPrompt = {
      metadata,
      rawBody: parsed.content,
      render(vars) {
        return template(vars);
      },
    };
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

const PromptMetadataSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().int().positive().optional(),
  schema: z.string().min(1).optional(),
  variables: z.array(z.string().min(1)),
  owner: z.string().min(1),
  updated: z.union([z.string(), z.date()]).transform((value) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : value,
  ),
});

function assertPromptId(id: string): void {
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`Invalid prompt id: ${id}`);
  }
}

function parsePromptMetadata(
  value: unknown,
  expectedId: string,
  filePath: string,
): PromptMetadata {
  const parsed = PromptMetadataSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Invalid prompt metadata in ${filePath}:\n${parsed.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n")}`,
    );
  }
  if (parsed.data.id !== expectedId) {
    throw new Error(
      `Prompt id mismatch in ${filePath}: expected ${expectedId}, got ${parsed.data.id}`,
    );
  }
  return parsed.data;
}
