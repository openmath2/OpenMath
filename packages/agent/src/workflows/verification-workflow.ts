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

export function runVerificationWorkflow(
  _deps: VerificationWorkflowDeps,
  _request: GenerateRequest,
  _options?: RunOptions,
): AsyncGenerator<WorkflowYield, WorkflowReturn, void> {
  throw new Error("runVerificationWorkflow: not implemented yet");
}
