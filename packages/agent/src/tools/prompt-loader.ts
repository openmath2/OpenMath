/**
 * Prompt file loader (architecture.md D-8).
 *
 * packages/agent/prompts/*.md 를 frontmatter + body로 파싱.
 * frontmatter → generateObject({ model, temperature, system, schema }) 메타.
 * body → Handlebars 변수 치환 ({{intent.objective}} 등).
 *
 * [비할당] 팀원이 매일 만지는 토스 단위.
 */

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
  _opts: FsPromptLoaderOptions,
): PromptLoader {
  throw new Error("createFsPromptLoader: not implemented yet");
}
