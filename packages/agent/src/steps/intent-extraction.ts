/** Step 2: Intent extraction. Single LLM agent (D-5). Output validated by IntentSchema (I-I1, I-I2). */

import type { LanguageModel } from "ai";

import type {
  GenerateRequest,
  Intent,
  RagResult,
  Strategy,
} from "../schemas/index.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export interface IntentExtractionDeps {
  model: LanguageModel;
  prompts: PromptLoader;
}

export interface IntentExtractionInput {
  request: GenerateRequest;
  refs: RagResult[];
  strategy: Strategy | null;
}

export interface IntentExtractionOutput {
  intent: Intent;
}

export async function extractIntent(
  _deps: IntentExtractionDeps,
  _input: IntentExtractionInput,
): Promise<IntentExtractionOutput> {
  throw new Error("extractIntent: not implemented yet");
}
