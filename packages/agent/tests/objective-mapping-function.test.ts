import { describe, expect, it } from "vitest";

import type { GenerateRequest, GeneratedProblem, Intent, RagResult } from "../src/schemas/index.js";
import { mapObjective } from "../src/steps/objective-mapping.js";

const request: GenerateRequest = {
  mode: "structural",
  school_level: "middle",
  grade: 1,
  topic: "9수03-01",
  topic_name: "함수의 개념",
  dims: ["A"],
  count: 5,
  difficulty: "medium",
  problem_type: "objective",
  source_problem_text: "함수의 뜻을 알고 함수값을 구할 수 있다.",
};

const intent: Intent = {
  objective_code: "9수05-01",
  objective_description: "자료의 정리와 해석",
  evaluation_dimensions: [{ id: "A", description: "함수식 찾기", must_preserve: true }],
  required_techniques: ["linear_function"],
  forbidden_techniques: [],
  surface_constraints: { difficulty: "medium", problem_type: "objective" },
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
      grade: 1,
      semester: null,
      topic_code: "9수03-01",
      topic_name: "함수의 개념",
      achievement_standard: "함수의 뜻을 알고 함수값을 구할 수 있다.",
      question_text: "직선의 식을 고르시오.",
      answer_text: "y=2x-2",
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

const candidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000030",
  mode: "structural",
  generation_kind: "function",
  question_text: "좌표평면에서 직선 l은 점 (0, -2)를 지나고 점 (3, 4)를 지난다. 다음 중 직선 l의 식으로 알맞은 것은?",
  expected_answer: "③",
  techniques_used: ["linear_function"],
  proposed_solution_trace: "두 좌표에서 기울기와 y절편을 구해 함수식 y = 2x - 2를 찾는다.",
  source_refs: ["ref-1"],
  inferred_intent: intent,
  generation_metadata: {
    model: "test",
    temperature: 0,
    prompt_id: "test",
    prompt_version: "0.0.0",
    attempt: 1,
    generated_at: "2026-06-06T00:00:00.000Z",
  },
};

describe("mapObjective function aliases", () => {
  it("allows broad extracted intent when candidate evidence supports a function-form request", async () => {
    const result = await mapObjective({}, { request, refs, candidate, intent, strategy: null });

    expect(result.gate.status).toBe("passed");
  });

  it("allows broad extracted intent when candidate evidence supports a linear-function application request", async () => {
    const result = await mapObjective({}, {
      request: { ...request, topic: "9수03-03", topic_name: "일차함수의 활용", source_problem_text: undefined },
      refs,
      candidate: {
        ...candidate,
        question_text:
          "한 시간에 1000원씩 더해지는 이용 요금이 기본요금 3000원에 x시간 이용료를 더한 y = 1000x + 3000으로 나타난다. 5시간 이용할 때 요금을 구하시오.",
        expected_answer: "8000원",
        proposed_solution_trace: "x=5를 대입하면 y = 1000*5 + 3000 = 8000이다.",
      },
      intent: { ...intent, objective_code: "9수03-08" },
      strategy: null,
    });

    expect(result.gate.status).toBe("passed");
  });

  it("allows broad extracted intent when candidate evidence supports a quadratic-equation application request", async () => {
    const result = await mapObjective({}, {
      request: { ...request, topic: "9수02-10", topic_name: "이차방정식의 활용", source_problem_text: undefined },
      refs,
      candidate: {
        ...candidate,
        generation_kind: "equation",
        question_text: "x(x+3)=10을 만족하는 x의 값을 모두 구하시오.",
        expected_answer: "2, -5",
        proposed_solution_trace: "x^2 + 3x - 10 = 0이고, (x+5)(x-2)=0이므로 해는 x=2, -5이다.",
      },
      intent: { ...intent, objective_code: "일차방정식을 풀 수 있고, 이를 활용하여 문제를 해결할 수 있다." },
      strategy: null,
    });

    expect(result.gate.status).toBe("passed");
  });

  it("allows broad extracted intent when candidate evidence supports a triangle-property request", async () => {
    const result = await mapObjective({}, {
      request: { ...request, topic: "9수04-02", topic_name: "삼각형의 성질", source_problem_text: undefined },
      refs,
      candidate: {
        ...candidate,
        generation_kind: "geometry",
        question_text: "삼각형 ABC에서 AB = AC이고 ∠A = 40도일 때, ∠B의 크기를 구하시오.",
        expected_answer: "70도",
        proposed_solution_trace: "이등변삼각형의 두 밑각은 같고 세 각의 합은 180도이므로 ∠B = 70도이다.",
      },
      intent: { ...intent, objective_code: "9수04-18" },
      strategy: null,
    });

    expect(result.gate.status).toBe("passed");
  });

  it("allows broad extracted intent when candidate evidence supports a prime-factorization request", async () => {
    const result = await mapObjective({}, {
      request: { ...request, topic: "9수01-01", topic_name: "소인수분해", source_problem_text: undefined },
      refs,
      candidate: {
        ...candidate,
        generation_kind: "expression",
        question_text: "294의 소인수를 모두 쓰시오.",
        expected_answer: "2, 3, 7",
        proposed_solution_trace: "294 = 2 * 3 * 7^2 이므로 소인수는 2, 3, 7이다.",
      },
      intent: { ...intent, objective_code: "9수01-03" },
      strategy: null,
    });

    expect(result.gate.status).toBe("passed");
  });
});
