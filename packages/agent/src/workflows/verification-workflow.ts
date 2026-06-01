/** Verification workflow — the deterministic Orchestrator (D-5 outer skeleton).
 *  Owns the user-visible 6-step progress. Streams ProgressEvent via async generator. */

import type {
  GenerateRequest,
  ProgressEvent,
  Verification,
} from "../schemas/index.js";
import type {
  ConstraintCriticAgent,
  GeneratorAgent,
  RefinerAgent,
  SolverAgent,
} from "../agents/index.js";
import type { MathEngineClient } from "../tools/math-engine-client.js";
import type { PromptLoader } from "../tools/prompt-loader.js";
import type { RagClient } from "../tools/rag-client.js";
import type { StrategyLoader } from "../tools/schema-loader.js";
import type { LanguageModel } from "ai";

export interface VerificationWorkflowDeps {
  rag: RagClient;
  mathEngine: MathEngineClient;
  prompts: PromptLoader;
  strategies: StrategyLoader;

  intentModel: LanguageModel;
  generator: GeneratorAgent;
  critic: ConstraintCriticAgent;
  refiner: RefinerAgent;
  solver: SolverAgent;
  objectiveLlm?: LanguageModel;
}

export interface RunOptions {
  maxRetries?: number;
  perStepTimeoutMs?: number;
}

export type WorkflowYield = ProgressEvent;

export type WorkflowReturn = {
  verifications: Verification[];
};

/* OM-79 contract: 본 workflow 가 구현될 때 (AUDIT_TASKS T-022), generate step (3/6) 의
 *   `done` 이벤트 직후 + sympy_verify (4/6) 의 `start` 이벤트 직전에 아래 yield 삽입:
 *
 *     yield {
 *       type: "preview",
 *       latex: firstCandidate.question_text,     // GeneratedProblem.question_text 는 LaTeX
 *       timestamp: new Date().toISOString(),
 *     };
 *
 *   ProgressEventSchema 가 이미 PreviewEvent 를 union 에 포함하므로 type-safe yield 가능.
 *   wire-adapter 의 toWireSseEvent("preview") 가 { latex } 페이로드로 직렬화 → FE 의
 *   parsePreview 가 받음 → useVerificationStream 의 STREAM_PREVIEW dispatch → S4 화면에
 *   첫 후보 LaTeX 미리보기 표시.
 */
export function runVerificationWorkflow(
  _deps: VerificationWorkflowDeps,
  _request: GenerateRequest,
  _options?: RunOptions,
): AsyncGenerator<WorkflowYield, WorkflowReturn, void> {
  throw new Error("runVerificationWorkflow: not implemented yet");
}
