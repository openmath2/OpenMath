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
import { extractIntent } from "../steps/intent-extraction.js";
import { ragSearch } from "../steps/rag-search.js";

export interface VerificationWorkflowDeps {
  rag: RagClient;
  mathEngine?: MathEngineClient;
  prompts?: PromptLoader;
  strategies?: StrategyLoader;

  intentModel?: LanguageModel;
  generator?: GeneratorAgent;
  critic?: ConstraintCriticAgent;
  refiner?: RefinerAgent;
  solver?: SolverAgent;
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

export async function* runVerificationWorkflow(
  deps: VerificationWorkflowDeps,
  request: GenerateRequest,
  _options?: RunOptions,
): AsyncGenerator<WorkflowYield, WorkflowReturn, void> {
  const timestamp = (): string => new Date().toISOString();

  yield {
    type: "step",
    step: "rag",
    status: "start",
    timestamp: timestamp(),
  };

  const ragStarted = Date.now();
  const rag = await ragSearch({ rag: deps.rag }, { request });

  yield {
    type: "step",
    step: "rag",
    status: "done",
    timestamp: timestamp(),
    data: {
      count: rag.refs.length,
      duration_ms: Date.now() - ragStarted,
      fallback_used: rag.fallback_used,
      refs: rag.refs.map((ref) => ({
        item_id: ref.item_id,
        similarity: ref.similarity,
        match_reason: ref.match_reason,
        topic_name: ref.problem.topic_name,
      })),
    },
  };

  yield {
    type: "step",
    step: "intent",
    status: "start",
    timestamp: timestamp(),
    data: {
      source_ref_count: rag.refs.length,
    },
  };

  const intentStarted = Date.now();
  const { intent } = await extractIntent(
    { model: deps.intentModel, prompts: deps.prompts },
    {
      request,
      refs: rag.refs,
      strategy: null,
    },
  );

  yield {
    type: "step",
    step: "intent",
    status: "done",
    timestamp: timestamp(),
    data: {
      duration_ms: Date.now() - intentStarted,
      objective_code: intent.objective_code,
      objective_description: intent.objective_description,
      evaluation_dimension_count: intent.evaluation_dimensions.length,
      source_ref_count: rag.refs.length,
    },
  };

  yield {
    type: "error",
    stage: "orchestrator",
    code: "PIPELINE_NOT_IMPLEMENTED",
    message:
      "RAG 검색과 의도 추출은 완료되었지만, 문제 생성/검증 파이프라인은 아직 구현되지 않았습니다.",
    recoverable: false,
    timestamp: timestamp(),
  };

  return { verifications: [] };
}
