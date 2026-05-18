/**
 * Strategy YAML loader.
 *
 * data/achievement-standards/<code>.yaml → Strategy 도메인 객체.
 * Step 2·3에서 생성 변형 룰을 제공.
 *
 * 도메인: `docs/specs/domain.md` §2.5.
 * [비할당] 데이터 담당이 매일 만지는 토스 단위.
 */

import type { Strategy } from "../schemas/index.js";

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
  _opts: FsStrategyLoaderOptions,
): StrategyLoader {
  throw new Error("createFsStrategyLoader: not implemented yet");
}
