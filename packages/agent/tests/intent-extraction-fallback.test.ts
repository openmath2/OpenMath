import { generateObject } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PromptLoader } from "../src/tools/prompt-loader.js";
import { resolveLanguageModel } from "../src/tools/llm-provider.js";
import {
  assertIntentInvariants,
  type GenerateRequest,
  type RagResult,
  type Strategy,
} from "../src/schemas/index.js";
import { extractIntent } from "../src/steps/intent-extraction.js";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateObject: vi.fn(),
  };
});

const generateObjectMock = vi.mocked(generateObject);

const model = resolveLanguageModel({
  kind: "openai",
  modelId: "test-model",
  apiKey: "test-key",
});

const prompts: PromptLoader = {
  load: async () => ({
    metadata: {
      id: "intent-extraction",
      version: "0.0.0",
      model: "test-model",
      temperature: 0,
      variables: [],
      owner: "test",
      updated: "2026-06-10",
    },
    rawBody: "Extract intent",
    render: () => "Extract intent",
  }),
};

const request: GenerateRequest = {
  mode: "structural",
  school_level: "middle",
  grade: 3,
  topic: "9수02-09",
  topic_name: "이차방정식",
  dims: ["인수분해", "판별식", "근과 계수"],
  count: 1,
  difficulty: "medium",
  problem_type: "objective",
};

const refs: RagResult[] = [
  {
    item_id: "ref-1",
    match_reason: "hybrid",
    problem: {
      item_id: "ref-1",
      source_dataset: "111",
      split: "train",
      source_label_type: "problem_label",
      school_level: "middle",
      grade: 3,
      semester: null,
      topic_code: "9수02-09",
      topic_name: "이차방정식",
      achievement_standard: null,
      question_text: "x^2 - 5x + 6 = 0을 푸시오.",
      answer_text: "2, 3",
      explanation_text: null,
      choice_blocks: [],
      problem_type_norm: "objective",
      difficulty_norm: "medium",
      question_image_relpath: null,
      answer_image_relpath: null,
      question_json_relpath: null,
      answer_json_relpath: null,
    },
  },
];

const strategy: Strategy = {
  code: "9수02-09",
  title: "이차방정식의 풀이",
  school_level: "middle",
  grade: 3,
  techniques: {
    required_at_least_one_of: ["factorization"],
    forbidden: ["graphing"],
  },
  evaluation_dimensions: [
    { id: "S1", description: "인수분해로 풀기", must_preserve: true },
    { id: "S2", description: "판별식 해석", must_preserve: false },
    { id: "S3", description: "근과 계수 관계", must_preserve: false },
  ],
  difficulty_range: ["easy", "medium"],
  problem_types_supported: ["objective", "short_answer"],
  structural_transforms: [],
  conceptual_transforms: [],
};

describe("extractIntent fallback", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
    generateObjectMock.mockRejectedValue(new Error("intent llm failed"));
  });

  it("inherits strategy dimensions verbatim when the LLM intent call fails", async () => {
    const result = await extractIntent(
      { model, prompts },
      { request, refs, strategy },
    );

    expect(result.data.evaluation_dimensions).toBe(strategy.evaluation_dimensions);
    expect(result.data.evaluation_dimensions).toEqual([
      { id: "S1", description: "인수분해로 풀기", must_preserve: true },
      { id: "S2", description: "판별식 해석", must_preserve: false },
      { id: "S3", description: "근과 계수 관계", must_preserve: false },
    ]);
    expect(result.gate.status).toBe("passed");
    expect(result.gate.evidence).toMatchObject({
      fallback: true,
      dimensions_source: "strategy",
    });
    assertIntentInvariants(result.data);
  });

  it("guesses request dimensions with only the first dimension marked must_preserve", async () => {
    const result = await extractIntent(
      { model, prompts },
      { request, refs, strategy: null },
    );

    expect(result.data.evaluation_dimensions).toEqual([
      { id: "A", description: "인수분해", must_preserve: true },
      { id: "B", description: "판별식", must_preserve: false },
      { id: "C", description: "근과 계수", must_preserve: false },
    ]);
    expect(result.data.evaluation_dimensions.filter((dimension) => dimension.must_preserve)).toHaveLength(1);
    expect(result.gate.status).toBe("passed");
    expect(result.gate.evidence).toMatchObject({
      fallback: true,
      dimensions_source: "guessed",
    });
    assertIntentInvariants(result.data);
  });
});
