import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { createInMemoryRagClient } from "../src/tools/rag-client.js";

describe("createInMemoryRagClient", () => {
  it("loads OpenMath canonical JSONL and maps results to SourceProblem", async () => {
    const jsonlPath = await writeFixture([
      canonicalRecord({
        problem_id: "111:train:middle-similarity",
        school_level: "middle",
        grade: 2,
        topic_name: "닮은 두 삼각형의 넓이의 비",
        achievement_code: "9수04-13",
        achievement_standard: "도형의 닮음의 의미와 닮은 도형의 성질을 이해한다.",
        question_text: "닮은 두 삼각형의 넓이의 비를 구하여라.",
        answer_text: "4:9",
        problem_type: "objective",
        difficulty: "easy",
        confidence: 0.92,
      }),
      canonicalRecord({
        problem_id: "111:train:middle-function",
        school_level: "middle",
        grade: 2,
        topic_name: "일차함수의 그래프",
        achievement_code: "9수03-06",
        achievement_standard: "일차함수의 그래프의 성질을 이해한다.",
        question_text: "일차함수의 기울기를 구하여라.",
        answer_text: "2",
        problem_type: "short_answer",
        difficulty: "medium",
        confidence: 0.9,
      }),
    ]);

    const rag = createInMemoryRagClient({ jsonlPath });
    const results = await rag.search({
      school_level: "middle",
      grade: 2,
      topic_name: "닮은 삼각형 넓이",
      problem_type: "objective",
      difficulty: "easy",
      k: 3,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.item_id).toBe("111:train:middle-similarity");
    expect(results[0]?.problem.source_dataset).toBe("111");
    expect(results[0]?.problem.achievement_standard).toBe(
      "도형의 닮음의 의미와 닮은 도형의 성질을 이해한다.",
    );
    expect(results[0]?.problem.problem_type_norm).toBe("objective");
    expect(results[0]?.match_reason).toBe("hybrid");
  });

  it("can exclude low-confidence achievement mappings", async () => {
    const jsonlPath = await writeFixture([
      canonicalRecord({
        problem_id: "111:train:low-confidence",
        school_level: "middle",
        grade: 1,
        topic_name: "소수와 합성수",
        achievement_code: "9수01-01",
        achievement_standard: "소인수분해의 뜻을 알고, 자연수를 소인수분해 할 수 있다.",
        question_text: "소수의 개수를 구하여라.",
        answer_text: "5",
        problem_type: "short_answer",
        difficulty: "easy",
        confidence: 0.42,
      }),
    ]);

    const rag = createInMemoryRagClient({
      jsonlPath,
      minAchievementConfidence: 0.8,
    });
    const results = await rag.search({
      school_level: "middle",
      grade: 1,
      topic_name: "소수",
      k: 3,
    });

    expect(results).toHaveLength(0);
  });
});

async function writeFixture(records: unknown[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "openmath-rag-"));
  const path = join(dir, "corpus.jsonl");
  await writeFile(path, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  return path;
}

function canonicalRecord(input: {
  problem_id: string;
  school_level: "middle" | "high";
  grade: 1 | 2 | 3 | null;
  topic_name: string;
  achievement_code: string;
  achievement_standard: string;
  question_text: string;
  answer_text: string;
  problem_type: "objective" | "essay" | "short_answer" | "subjective";
  difficulty: "easy" | "medium" | "hard";
  confidence: number;
}) {
  return {
    schema_version: "openmath-rag-record-v1",
    id: {
      problem_id: input.problem_id,
      source_dataset: "111",
      split: "train",
      item_id: input.problem_id.split(":").at(-1),
      source_label_type: "problem_label",
    },
    curriculum: {
      active_curriculum: "2022 개정",
      curriculum: "2022 개정",
      curriculum_source: "official_2022_math_curriculum",
      school_level: input.school_level,
      grade: input.grade,
      semester: null,
      topic_code: "8207052",
      topic_name: input.topic_name,
      achievement_code: input.achievement_code,
      achievement_standard: input.achievement_standard,
      achievement_domain: "기하",
      achievement_unit: input.topic_name,
      achievement_keywords: input.topic_name.split(" "),
      achievement_mapping_method: "topic_to_2022_achievement_similarity",
      achievement_confidence: input.confidence,
    },
    problem: {
      question_text: input.question_text,
      choice_blocks: [],
      answer_text: input.answer_text,
      explanation_text: "풀이",
      problem_type: input.problem_type,
      difficulty: input.difficulty,
    },
    taxonomy: {
      primary_type_id: "OPT_VISUAL_INTERPRETATION",
      type_ids: ["OPT_OBJECTIVE_CHOICE"],
      primary_subtype_id: "OPS_FIND_LENGTH_AREA_ANGLE",
      subtype_ids: ["OPS_SINGLE_CHOICE"],
    },
    rag: {
      retrieval_text: `${input.topic_name}\n${input.question_text}\n${input.achievement_standard}`,
      embedding_text: `${input.topic_name}\n${input.question_text}`,
      generation_hints: {},
    },
    media: {
      question_image_relpath: null,
      answer_image_relpath: null,
      has_question_image_path: false,
      has_answer_image_path: false,
      has_question_image_file: false,
      has_answer_image_file: false,
      requires_visual_reading: false,
      requires_context_modeling: false,
      requires_formula: true,
    },
    quality: {
      is_usable: true,
      missing_fields: [],
      warnings: [],
      normalization_notes: [],
    },
    source_trace: {
      record_json_relpath: null,
      original_question_json_relpath: null,
      original_answer_json_relpath: null,
    },
  };
}
