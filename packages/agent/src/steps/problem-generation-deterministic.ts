import { randomUUID } from "node:crypto";

import type { GenerateRequest, GeneratedProblem, Intent, RagResult } from "../schemas/index.js";
import { generationKindForTopic, getGenerateRequestTopicCode } from "../schemas/index.js";
import { deterministicTemplateForRequest } from "./problem-generation-deterministic-templates.js";

export function deterministicInitialCandidate(input: {
  readonly request: GenerateRequest;
  readonly intent: Intent;
  readonly refs: readonly RagResult[];
  readonly attempt: number;
}): GeneratedProblem | null {
  const topicCode = getGenerateRequestTopicCode(input.request);
  const template = deterministicTemplateForRequest(input.request);
  if (template === null) return null;
  return {
    candidate_id: randomUUID(),
    mode: input.request.mode === "conceptual" ? "conceptual" : "structural",
    generation_kind: generationKindForTopic(topicCode),
    ...template,
    techniques_used: input.intent.required_techniques,
    source_refs: input.refs.map((ref) => ref.item_id),
    inferred_intent: input.intent,
    generation_metadata: {
      model: "deterministic-topic-generator",
      temperature: 0,
      prompt_id: "deterministic-topic-generator",
      prompt_version: "0.1.0",
      attempt: input.attempt,
      generated_at: new Date().toISOString(),
    },
  };
}
