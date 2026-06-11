/** RefinerAgent — D-5 GenerationSpecialist team. 비평 힌트를 받아 prior 후보를 *수선*한다.
 *  Generator의 백지 재생성과 달리 자기 프롬프트(refiner.md)로 변경 범위를 prior 근처로 제한. */

import type { LanguageModel } from "ai";

import type { GenerateRequest, GeneratedProblem, Intent, RagResult, Strategy } from "../schemas/index.js";
import { generationKindForTopic, getGenerateRequestTopicCode } from "../schemas/index.js";
import type { PromptLoader } from "../tools/prompt-loader.js";
import {
  assembleGeneratedProblem,
  generateCandidateObject,
} from "./generator-agent.js";

export interface RefineInput {
  prior: GeneratedProblem;
  request: GenerateRequest;
  intent: Intent;
  refs: RagResult[];
  strategy: Strategy | null;
  attempt: number;
  hints: string[];
  signal?: AbortSignal;
}

export interface RefinerAgent {
  refine(input: RefineInput): Promise<GeneratedProblem>;
}

export interface RefinerAgentDeps {
  model: LanguageModel;
  modelId: string;
  promptId: string;
  prompts: PromptLoader;
}

export function createRefinerAgent(deps: RefinerAgentDeps): RefinerAgent {
  return {
    async refine(input) {
      const prompt = await deps.prompts.load(deps.promptId);
      const generationKind = generationKindForTopic(getGenerateRequestTopicCode(input.request));
      const basePromptVars = {
        prior: input.prior,
        request: input.request,
        generationKind,
        intent: input.intent,
        refs: input.refs,
        strategy: input.strategy === null ? "" : JSON.stringify(input.strategy, null, 2),
        hints: input.hints,
      };
      const object = await generateCandidateObject({
        model: deps.model,
        prompt: prompt.render(basePromptVars),
        temperature: prompt.metadata.temperature,
        signal: input.signal,
        retryPromptForSchemaError(schemaError) {
          return prompt.render({ ...basePromptVars, schemaError });
        },
      });

      return assembleGeneratedProblem({
        request: input.request,
        intent: input.intent,
        refs: input.refs,
        attempt: input.attempt,
        object,
        modelId: deps.modelId,
        temperature: prompt.metadata.temperature,
        promptId: prompt.metadata.id,
        promptVersion: prompt.metadata.version,
      });
    },
  };
}
