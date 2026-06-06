import { describe, expect, it } from "vitest";

import { GenerateRequestSchema } from "../src/schemas/index.js";
import type { RagClient } from "../src/tools/rag-client.js";
import { ragSearch } from "../src/steps/rag-search.js";
import type { RagQuery, RagResult } from "../src/schemas/index.js";

describe("ragSearch", () => {
  it("keeps the requested topic before relaxing difficulty and problem type", async () => {
    const calls: RagQuery[] = [];
    const exactTopicResult: RagResult = {
      ...sourceResult,
      item_id: "111:train:variable-expression",
      problem: {
        ...sourceResult.problem,
        item_id: "111:train:variable-expression",
        topic_code: "9수02-01",
        topic_name: "식의 값",
        question_text: "a=3, b=5일 때 2a+b의 값을 구하여라.",
        answer_text: "11",
        problem_type_norm: "essay",
        difficulty_norm: "easy",
      },
    };
    const contaminatedResult: RagResult = {
      ...sourceResult,
      item_id: "111:train:radical-expression",
      problem: {
        ...sourceResult.problem,
        item_id: "111:train:radical-expression",
        topic_code: "9수01-01",
        topic_name: "인수분해 공식을 이용한 식의 값",
        question_text: "x=sqrt(3)+1일 때 x^2의 값을 구하여라.",
      },
    };
    const rag: RagClient = {
      search: async (query) => {
        calls.push(query);
        if (
          query.topic_code === "9수02-01" &&
          query.difficulty === undefined &&
          query.problem_type === undefined
        ) {
          return [exactTopicResult];
        }
        if (query.topic_code === undefined) {
          return [contaminatedResult];
        }
        return [];
      },
    };

    const request = GenerateRequestSchema.parse({
      grade: 1,
      topic: "9수02-01",
      topic_name: "문자의 사용과 식의 값",
      mode: "structural",
      dims: ["reasoning"],
    });

    const result = await ragSearch({ rag, perStepTimeoutMs: 1000 }, { request });

    expect(result.refs.map((ref) => ref.item_id)).toEqual([
      "111:train:variable-expression",
    ]);
    expect(calls.map((call) => call.topic_code)).toEqual([
      "9수02-01",
      "9수02-01",
    ]);
  });

  it("falls back to topic-name retrieval when an app achievement code has no exact corpus match", async () => {
    const calls: RagQuery[] = [];
    const rag: RagClient = {
      search: async (query) => {
        calls.push(query);
        if (query.topic_code === undefined && query.topic_name === "자료의 정리와 해석") {
          return [sourceResult];
        }
        return [];
      },
    };

    const request = GenerateRequestSchema.parse({
      grade: 1,
      topic: "9수05-01",
      topic_name: "자료의 정리와 해석",
      mode: "structural",
      dims: ["reasoning"],
    });

    const result = await ragSearch({ rag, perStepTimeoutMs: 1000 }, { request });

    expect(result.refs).toHaveLength(1);
    expect(calls.map((call) => call.topic_code)).toEqual([
      "9수05-01",
      "9수05-01",
      undefined,
    ]);
  });

  it("rejects weak exact-code topic noise before using a topic alias fallback", async () => {
    const calls: RagQuery[] = [];
    const noisyResult: RagResult = {
      ...sourceResult,
      item_id: "111:train:blood-type-statistics",
      problem: {
        ...sourceResult.problem,
        item_id: "111:train:blood-type-statistics",
        topic_code: "9수04-06",
        topic_name: "최빈값 구하기",
        achievement_standard: "확률의 개념과 기본 성질을 이해한다.",
        question_text: "최빈값과 확률 사이에는 어떤 관계가 있는지 말하여라.",
      },
    };
    const tangentResult: RagResult = {
      ...sourceResult,
      item_id: "111:train:circle-tangent",
      problem: {
        ...sourceResult.problem,
        item_id: "111:train:circle-tangent",
        topic_code: "9수03-18",
        topic_name: "원의 접선 성질",
        achievement_standard: "원의 현과 접선에 관한 성질을 이해한다.",
        question_text: "원 O의 접선과 반지름이 이루는 각을 구하여라.",
      },
    };
    const rag: RagClient = {
      search: async (query) => {
        calls.push(query);
        if (query.topic_code === "9수04-06" && query.difficulty === undefined) {
          return [noisyResult];
        }
        if (query.topic_code === undefined && query.topic_name === "원의 접선 성질") {
          return [tangentResult];
        }
        return [];
      },
    };

    const request = GenerateRequestSchema.parse({
      grade: 3,
      topic: "9수04-06",
      topic_name: "원과 직선의 위치 관계",
      mode: "structural",
      dims: ["reasoning"],
    });

    const result = await ragSearch({ rag, perStepTimeoutMs: 1000 }, { request });

    expect(result.refs.map((ref) => ref.item_id)).toEqual(["111:train:circle-tangent"]);
    expect(calls.some((call) => call.topic_name === "원의 접선 성질")).toBe(true);
  });
});

const sourceResult: RagResult = {
  item_id: "111:train:statistics",
  match_reason: "semantic",
  similarity: 0.8,
  problem: {
    item_id: "111:train:statistics",
    source_dataset: "111",
    split: "train",
    source_label_type: "problem_label",
    school_level: "middle",
    grade: 1,
    semester: null,
    topic_code: "7105011",
    topic_name: "자료의 정리와 해석",
    achievement_standard: "자료를 정리하고 해석할 수 있다.",
    question_text: "도수분포표를 보고 평균을 구하여라.",
    answer_text: "12",
    explanation_text: "풀이",
    choice_blocks: [],
    problem_type_norm: "objective",
    difficulty_norm: "medium",
    question_image_relpath: null,
    answer_image_relpath: null,
    question_json_relpath: null,
    answer_json_relpath: null,
  },
};
