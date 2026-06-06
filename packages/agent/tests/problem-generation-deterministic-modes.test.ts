import { describe, expect, it } from "vitest";

import type { GenerateRequest, Intent, RagResult } from "../src/schemas/index.js";
import { deterministicInitialCandidate } from "../src/steps/problem-generation-deterministic.js";

const intent: Intent = {
  objective_code: "9수02-10",
  objective_description: "이차방정식을 활용한다.",
  evaluation_dimensions: [{ id: "A", description: "활용", must_preserve: true }],
  required_techniques: ["quadratic_equation"],
  forbidden_techniques: [],
  surface_constraints: { difficulty: "medium", problem_type: "objective" },
};

const baseRequest: GenerateRequest = {
  grade: 3,
  topic: "9수02-10",
  topic_name: "이차방정식의 활용",
  mode: "structural",
  school_level: "middle",
  dims: ["A"],
  count: 5,
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
      topic_code: "9수02-10",
      topic_name: "이차방정식의 활용",
      achievement_standard: "이차방정식을 활용하여 문제를 해결한다.",
      question_text: "이차방정식 활용 문제",
      answer_text: "2",
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

const topicCodes = [
  "9수01-01",
  "9수01-02",
  "9수01-03",
  "9수01-04",
  "9수01-05",
  "9수01-06",
  "9수02-01",
  "9수02-02",
  "9수02-03",
  "9수02-04",
  "9수02-05",
  "9수02-06",
  "9수02-07",
  "9수02-08",
  "9수02-09",
  "9수02-10",
  "9수03-01",
  "9수03-02",
  "9수03-03",
  "9수03-04",
  "9수04-01",
  "9수04-02",
  "9수04-03",
  "9수04-04",
  "9수04-05",
  "9수04-06",
  "9수04-07",
  "9수05-01",
  "9수05-02",
  "9수05-03",
] as const;

type TopicCode = (typeof topicCodes)[number];

const conceptualSignals: Readonly<Record<TopicCode, readonly string[]>> = {
  "9수01-01": ["소인수분해가"],
  "9수01-02": ["수직선", "0에 더 가까운"],
  "9수01-03": ["기온"],
  "9수01-04": ["기약분수"],
  "9수01-05": ["sqrt(50)", "정사각형"],
  "9수01-06": ["정사각형", "넓이"],
  "9수02-01": ["직사각형", "둘레"],
  "9수02-02": ["원래의 일차식"],
  "9수02-03": ["어떤 수"],
  "9수02-04": ["공책"],
  "9수02-05": ["직사각형", "전개"],
  "9수02-06": ["어떤 수"],
  "9수02-07": ["사과", "배"],
  "9수02-08": ["직사각형"],
  "9수02-09": ["x^2 - 2x - 8"],
  "9수02-10": ["두 수", "곱"],
  "9수03-01": ["복사", "요금"],
  "9수03-02": ["변화량"],
  "9수03-03": ["택시"],
  "9수03-04": ["꼭짓점"],
  "9수04-01": ["세 점", "선분", "삼각형"],
  "9수04-02": ["밑각"],
  "9수04-03": ["평행사변형"],
  "9수04-04": ["닮음비"],
  "9수04-05": ["sin A"],
  "9수04-06": ["두 점"],
  "9수04-07": ["원주각", "중심각"],
  "9수05-01": ["상대도수가"],
  "9수05-02": ["주사위"],
  "9수05-03": ["중앙값"],
};

describe("deterministicInitialCandidate mode separation", () => {
  it("creates different structural and conceptual candidates for the same topic", () => {
    const structural = deterministicInitialCandidate({
      request: baseRequest,
      intent,
      refs,
      attempt: 1,
    });
    const conceptual = deterministicInitialCandidate({
      request: { ...baseRequest, mode: "conceptual" },
      intent,
      refs,
      attempt: 1,
    });

    expect(structural?.mode).toBe("structural");
    expect(conceptual?.mode).toBe("conceptual");
    expect(structural?.question_text).not.toBe(conceptual?.question_text);
    expect(structural?.proposed_solution_trace).toContain("구조동형");
    expect(conceptual?.proposed_solution_trace).toContain("개념동형");
  });

  it("keeps structural and conceptual templates separated for all middle-school topics", () => {
    for (const topic of topicCodes) {
      const structural = deterministicInitialCandidate({
        request: { ...baseRequest, topic },
        intent,
        refs,
        attempt: 1,
      });
      const conceptual = deterministicInitialCandidate({
        request: { ...baseRequest, topic, mode: "conceptual" },
        intent,
        refs,
        attempt: 1,
      });

      expect(structural?.mode, topic).toBe("structural");
      expect(conceptual?.mode, topic).toBe("conceptual");
      expect(structural?.question_text, topic).not.toBe(conceptual?.question_text);
    }
  });

  it("keeps conceptual candidates from being label-only structural variants", () => {
    for (const topic of topicCodes) {
      const conceptual = deterministicInitialCandidate({
        request: { ...baseRequest, topic, mode: "conceptual" },
        intent,
        refs,
        attempt: 1,
      });

      const evidence = [
        conceptual?.question_text ?? "",
        conceptual?.proposed_solution_trace ?? "",
      ].join("\n");
      const hasSignal = conceptualSignals[topic].some((signal) => evidence.includes(signal));

      expect(hasSignal, `${topic}: ${conceptual?.question_text}`).toBe(true);
    }
  });

  it("keeps application and concept templates focused on modeling or interpretation", () => {
    const modelingTopics: readonly TopicCode[] = ["9수02-03", "9수02-04", "9수02-10"];
    for (const topic of modelingTopics) {
      const conceptual = deterministicInitialCandidate({
        request: { ...baseRequest, topic, mode: "conceptual" },
        intent,
        refs,
        attempt: 1,
      });

      expect(conceptual?.question_text, topic).toContain("방정식을 세워");
      expect(conceptual?.question_text, topic).not.toMatch(/=\s*-?\d/u);
    }

    const median = deterministicInitialCandidate({
      request: { ...baseRequest, topic: "9수05-03", mode: "conceptual" },
      intent,
      refs,
      attempt: 1,
    });

    expect(median?.question_text).toContain("추가");
  });
});
