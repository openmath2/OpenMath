/** GeneratorAgent — D-5 GenerationSpecialist team. Produces GeneratedProblem candidate. */

import type { LanguageModel } from "ai";

import type {
  GenerateRequest,
  GeneratedProblem,
  Intent,
  RagResult,
  Strategy,
} from "../schemas/index.js";

export interface GeneratorAgentInput {
  request: GenerateRequest;
  intent: Intent;
  refs: RagResult[];
  strategy: Strategy | null;
  attempt: number;
  refinementHint?: string;
}

export interface GeneratorAgent {
  generate(input: GeneratorAgentInput): Promise<GeneratedProblem>;
}

export interface GeneratorAgentDeps {
  model: LanguageModel;
  promptId: string;
}

/* OM-55 contract: generate() 가 구현될 때 (AUDIT_TASKS T-009) input.request.mode 처리:
 *
 *     // "auto" 는 현재 structural 로 처리. conceptual 듀얼 시도는 Q-U1 결정 후 구현.
 *     const resolvedMode: "structural" | "conceptual" =
 *       input.request.mode === "auto" ? "structural" : input.request.mode;
 *
 *   GenerateModeSchema 는 ["structural", "conceptual", "auto"] 3-enum 인데 GeneratedProblem.mode 는
 *   ["structural", "conceptual"] 2-enum. "auto" 가 들어오면 명시적 fallback 필요 — 위 한 줄로
 *   silent 분기 제거 + 사유 (Q-U1) 가시화.
 */
export function createGeneratorAgent(_deps: GeneratorAgentDeps): GeneratorAgent {
  throw new Error("createGeneratorAgent: not implemented yet");
}
