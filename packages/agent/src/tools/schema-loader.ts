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
import { basename, resolve } from "node:path";

import { parse } from "yaml";

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
  const strategiesDir = resolve(opts.strategiesDir);
  const cache = new Map<string, Strategy | null>();

  async function load(code: string): Promise<Strategy | null> {
    if (!opts.hotReload && cache.has(code)) {
      return cache.get(code) ?? null;
    }

    const strategy = await readStrategy(strategiesDir, code);
    cache.set(code, strategy);
    return strategy;
  }

  return {
    load,
    async loadAll() {
      const entries = await readdir(strategiesDir, { withFileTypes: true }).catch(
        (error: unknown) => {
          if (isMissingFileError(error)) {
            return [];
          }
          throw error;
        },
      );
      const yamlFiles = entries
        .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
        .map((entry) => basename(entry.name).replace(/\.ya?ml$/, ""));

      const strategies = await Promise.all(yamlFiles.map((code) => load(code)));
      return strategies.filter((strategy): strategy is Strategy => strategy !== null);
    },
    async reload() {
      cache.clear();
    },
  };
}

async function readStrategy(
  strategiesDir: string,
  code: string,
): Promise<Strategy | null> {
  const path = resolve(strategiesDir, `${code}.yaml`);
  let file: string;
  try {
    file = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }

  const parsed = StrategySchema.parse(parse(file));
  if (parsed.code !== code) {
    throw new Error(`Strategy ${path} has code=${parsed.code}, expected ${code}`);
  }
  assertStrategyInvariants(parsed);
  return parsed;
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
