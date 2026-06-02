/**
 * Strategy YAML loader.
 *
 * data/achievement-standards/<code>.yaml → Strategy 도메인 객체.
 * Step 2·3에서 생성 변형 룰을 제공.
 *
 * 도메인: `docs/specs/domain.md` §2.5.
 * [비할당] 데이터 담당이 매일 만지는 토스 단위.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import YAML from "yaml";

import {
  StrategySchema,
  assertStrategyInvariants,
  type Strategy,
} from "../schemas/index.js";

export interface StrategyLoader {
  load(code: string): Promise<Strategy | null>;
  loadAll(): Promise<Strategy[]>;
  reload?(): Promise<void>;
}

export interface FsStrategyLoaderOptions {
  strategiesDir: string;
  hotReload?: boolean;
}

export function createFsStrategyLoader(
  opts: FsStrategyLoaderOptions,
): StrategyLoader {
  const cache = new Map<string, Strategy>();

  async function load(code: string): Promise<Strategy | null> {
    assertStrategyCode(code);
    if (opts.hotReload !== true) {
      const cached = cache.get(code);
      if (cached !== undefined) return cached;
    }
    const strategy = await readStrategyFile(join(opts.strategiesDir, `${code}.yaml`));
    if (strategy === null) return null;
    cache.set(strategy.code, strategy);
    return strategy;
  }

  return {
    load,
    async loadAll() {
      const entries = await readdir(opts.strategiesDir, { withFileTypes: true });
      const strategies: Strategy[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) continue;
        const strategy = await readStrategyFile(join(opts.strategiesDir, entry.name));
        if (strategy !== null) {
          cache.set(strategy.code, strategy);
          strategies.push(strategy);
        }
      }
      return strategies;
    },
    async reload() {
      cache.clear();
    },
  };
}

function assertStrategyCode(code: string): void {
  if (!/^(9수|10공수)\d{2}-\d{2}$/.test(code)) {
    throw new Error(`Invalid strategy code: ${code}`);
  }
}

async function readStrategyFile(filePath: string): Promise<Strategy | null> {
  let contents: string;
  try {
    contents = await readFile(filePath, "utf8");
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
  const value: unknown = YAML.parse(contents);
  const parsed = StrategySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid strategy YAML ${filePath}: ${parsed.error.message}`);
  }
  assertStrategyInvariants(parsed.data);
  return parsed.data;
}
