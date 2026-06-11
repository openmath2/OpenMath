import { describe, expect, it } from "vitest";

import type { GeneratedProblem, Intent, SourceProblem } from "../src/schemas/index.js";
import {
  assertGeneratedProblemInvariants,
  assertSourceProblemInvariants,
} from "../src/schemas/index.js";

const sourceBase: SourceProblem = {
  item_id: "seed-1",
  source_dataset: "110",
  split: "train",
  source_label_type: "text",
  school_level: "middle",
  grade: 3,
  semester: 1,
  topic_code: "9수02-09",
  topic_name: "이차방정식",
  achievement_standard: "9수02-09",
  question_text: "x + 1 = 2",
  answer_text: "1",
  explanation_text: "양변에서 1을 뺀다.",
  choice_blocks: null,
  problem_type_norm: "short_answer",
  difficulty_norm: "easy",
  question_image_relpath: null,
  answer_image_relpath: null,
  question_json_relpath: null,
  answer_json_relpath: null,
};

const intentBase: Intent = {
  objective_code: "9수02-09",
  objective_description: "이차방정식을 풀 수 있다",
  evaluation_dimensions: [
    { id: "A", description: "인수분해", must_preserve: true },
    { id: "B", description: "해 검증", must_preserve: false },
  ],
  required_techniques: ["factorization"],
  forbidden_techniques: [],
  surface_constraints: { difficulty: "medium", problem_type: "short_answer" },
};

const generatedBase: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000001",
  mode: "structural",
  generation_kind: "equation",
  question_text: "x^{2} - 7x + 10 = 0",
  expected_answer: "2, 5",
  techniques_used: ["factorization"],
  proposed_solution_trace: "인수분해한다.",
  source_refs: ["seed-1"],
  inferred_intent: intentBase,
  generation_metadata: {
    model: "test",
    temperature: 0,
    prompt_id: "problem-generator",
    prompt_version: "0.1.0",
    attempt: 1,
    generated_at: "2026-06-02T00:00:00.000Z",
  },
};

describe("assertSourceProblemInvariants", () => {
  it("passes a valid source problem", () => {
    expect(() => assertSourceProblemInvariants(sourceBase)).not.toThrow();
  });

  it("fails I-S1", () => {
    expect(() => assertSourceProblemInvariants({ ...sourceBase, question_text: "" })).toThrow(/I-S1/);
  });

  it("fails I-S2", () => {
    expect(() => assertSourceProblemInvariants({ ...sourceBase, achievement_standard: null })).toThrow(/I-S2/);
  });

  it("fails I-S3", () => {
    expect(() => assertSourceProblemInvariants({ ...sourceBase, question_text: "\\dfrac{1}{2}" })).toThrow(/I-S3/);
  });

  it("fails I-S4", () => {
    expect(() => assertSourceProblemInvariants({ ...sourceBase, explanation_text: null })).toThrow(/I-S4/);
  });

  it("fails I-S5", () => {
    expect(() => assertSourceProblemInvariants({ ...sourceBase, grade: null })).toThrow(/I-S5/);
  });
});

describe("assertGeneratedProblemInvariants", () => {
  it("passes a valid generated problem", () => {
    expect(() => assertGeneratedProblemInvariants(generatedBase, intentBase)).not.toThrow();
  });

  it("fails I-G1", () => {
    expect(() => assertGeneratedProblemInvariants({
      ...generatedBase,
      inferred_intent: { ...intentBase, objective_code: "9수02-10" },
    }, intentBase)).toThrow(/I-G1/);
  });

  it("fails I-G2", () => {
    expect(() => assertGeneratedProblemInvariants({
      ...generatedBase,
      inferred_intent: { ...intentBase, required_techniques: ["formula"] },
    }, intentBase)).toThrow(/I-G2/);
  });

  it("fails I-G3", () => {
    expect(() => assertGeneratedProblemInvariants({
      ...generatedBase,
      mode: "conceptual",
      inferred_intent: {
        ...intentBase,
        evaluation_dimensions: [{ id: "A", description: "완전제곱식", must_preserve: true }],
      },
    }, intentBase)).toThrow(/I-G3/);
  });
});
