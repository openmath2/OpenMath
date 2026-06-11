/** ClassifierAgent — 추출 문제를 교육과정 카탈로그 단원으로 분류한 뒤 코드로 스냅.
 *
 * LLM 은 카탈로그 안의 코드를 고르고, resolveClassification 이 그 결과를
 * 카탈로그(curriculum-topics)에 맞춰 검증·보정한다. 코드를 못 맞추면 이름으로,
 * 그것도 안 되면 확신을 크게 낮춰 사용자가 확인 화면에서 직접 고르게 한다.
 */

import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";

import {
  ClassificationAlternativeSchema,
  DifficultySchema,
  ProblemTypeSchema,
  findCurriculumTopic,
  findCurriculumTopicByName,
  formatCurriculumCatalog,
  type Classification,
  type Extraction,
} from "../schemas/index.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export const LlmClassificationSchema = z.object({
  topic_code: z.string().min(1),
  topic_name: z.string().min(1),
  problem_type: ProblemTypeSchema,
  difficulty: DifficultySchema,
  confidence: z.number().min(0).max(1),
  alternatives: z.array(ClassificationAlternativeSchema).default([]),
});

export type LlmClassification = z.infer<typeof LlmClassificationSchema>;

export interface ClassifierAgentInput {
  extraction: Pick<Extraction, "question_text" | "choices">;
  signal?: AbortSignal;
}

export interface ClassifierAgent {
  classify(input: ClassifierAgentInput): Promise<Classification>;
}

export interface ClassifierAgentDeps {
  model: LanguageModel;
  modelId: string;
  promptId: string;
  prompts: PromptLoader;
}

export function createClassifierAgent(deps: ClassifierAgentDeps): ClassifierAgent {
  return {
    async classify(input) {
      const prompt = await deps.prompts.load(deps.promptId);
      const rendered = prompt.render({
        catalog: formatCurriculumCatalog(),
        questionText: input.extraction.question_text,
        choices:
          input.extraction.choices === null || input.extraction.choices.length === 0
            ? "(없음)"
            : input.extraction.choices.join(" / "),
      });
      const { object } = await generateObject({
        model: deps.model,
        schema: LlmClassificationSchema,
        mode: "json",
        temperature: prompt.metadata.temperature,
        prompt: rendered,
        abortSignal: input.signal,
      });
      return resolveClassification(object);
    },
  };
}

/** LLM 출력의 topic_code 를 카탈로그로 스냅. 코드 일치 우선 → 이름 매칭 → 폴백(확신 강등). */
export function resolveClassification(raw: LlmClassification): Classification {
  const byCode = findCurriculumTopic(raw.topic_code);
  const matched = byCode ?? findCurriculumTopicByName(raw.topic_name);

  const alternatives = raw.alternatives
    .map((alt) => findCurriculumTopic(alt.topic_code) ?? findCurriculumTopicByName(alt.topic_name))
    .filter((topic): topic is NonNullable<typeof topic> => topic !== undefined)
    .map((topic) => ({ topic_code: topic.code, topic_name: topic.name }));

  if (matched === undefined) {
    // 코드·이름 모두 카탈로그 밖. 유효한 대안이 있으면 그 첫 번째로 강등 매칭한다
    // (학교급을 raw 코드 접두로만 추정하면 오분류 위험 — 대안의 실제 학교급을 쓴다).
    const firstAlt = alternatives[0];
    const promoted = firstAlt === undefined ? undefined : findCurriculumTopic(firstAlt.topic_code);
    if (promoted !== undefined) {
      return {
        school_level: promoted.school_level,
        grade: promoted.grade,
        topic_code: promoted.code,
        topic_name: promoted.name,
        problem_type: raw.problem_type,
        difficulty: raw.difficulty,
        confidence: Math.min(raw.confidence, 0.4),
        alternatives: alternatives.slice(1),
      };
    }
    // 대안도 없음 — 단원을 비워 사용자가 확인 화면에서 직접 고르게 한다.
    return {
      school_level: raw.topic_code.startsWith("10") ? "high" : "middle",
      grade: null,
      topic_code: "",
      topic_name: "",
      problem_type: raw.problem_type,
      difficulty: raw.difficulty,
      confidence: Math.min(raw.confidence, 0.3),
      alternatives,
    };
  }

  // 코드는 못 맞췄지만 이름으로 맞춘 경우 확신을 약간 강등.
  const confidence = byCode === undefined ? Math.min(raw.confidence, 0.5) : raw.confidence;
  return {
    school_level: matched.school_level,
    grade: matched.grade,
    topic_code: matched.code,
    topic_name: matched.name,
    problem_type: raw.problem_type,
    difficulty: raw.difficulty,
    confidence,
    alternatives: alternatives.filter((alt) => alt.topic_code !== matched.code),
  };
}
