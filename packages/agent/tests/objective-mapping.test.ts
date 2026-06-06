import { describe, expect, it } from "vitest";

import type {
  GenerateRequest,
  GeneratedProblem,
  Intent,
  RagResult,
} from "../src/schemas/index.js";
import { mapObjective } from "../src/steps/objective-mapping.js";

const request: GenerateRequest = {
  mode: "structural",
  school_level: "middle",
  grade: 2,
  topic: "9수04-05",
  topic_name: "삼각비",
  dims: ["A"],
  count: 5,
  difficulty: "medium",
  problem_type: "objective",
  source_problem_text: "직각삼각형에서 삼각비의 값을 구하고 활용한다.",
};

const intent: Intent = {
  objective_code: "9수04-05",
  objective_description: "직각삼각형에서 삼각비의 값을 구하고 활용한다.",
  evaluation_dimensions: [
    { id: "A", description: "삼각비를 이용해 길이를 구한다", must_preserve: true },
  ],
  required_techniques: ["trigonometric_ratio"],
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
      grade: 3,
      semester: null,
      topic_code: "9수04-05",
      topic_name: "삼각비",
      achievement_standard: "직각삼각형에서 삼각비의 값을 구하고 활용한다.",
      question_text: "직각삼각형에서 sin A의 값을 구하여라.",
      answer_text: "3/5",
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
  candidate_id: "00000000-0000-0000-0000-000000000006",
  mode: "structural",
  generation_kind: "geometry",
  question_text: "직각삼각형 ABC에서 cos A = 4/5일 때 sin A의 값을 구하시오.",
  expected_answer: "3/5",
  proposed_solution_trace: "sin**2 A + cos**2 A = 1을 이용한다.",
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

describe("mapObjective", () => {
  it("passes without a strategy when generation kind matches the requested topic", async () => {
    const result = await mapObjective(
      {},
      { request, refs, candidate, intent, strategy: null },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("fails when candidate generation kind does not match the requested topic", async () => {
    const result = await mapObjective(
      {},
      {
        request,
        refs,
        candidate: { ...candidate, generation_kind: "equation" },
        intent,
        strategy: null,
      },
    );

    expect(result.gate.status).toBe("failed");
    expect(result.gate.failure_detail?.code).toBe("generation_kind_mismatch");
  });

  it("fails when extracted intent objective code differs from the requested topic", async () => {
    const mismatchedIntent: Intent = {
      ...intent,
      objective_code: "9수05-03",
      objective_description: "대푯값과 산포도를 이해한다.",
    };
    const result = await mapObjective(
      {},
      {
        request,
        refs,
        candidate: {
          ...candidate,
          question_text: "5개의 변량 3, a, 5, b, 9의 표준편차를 구하시오.",
          inferred_intent: mismatchedIntent,
        },
        intent: mismatchedIntent,
        strategy: null,
      },
    );

    expect(result.gate.status).toBe("failed");
    expect(result.gate.failure_detail?.code).toBe("intent_topic_mismatch");
  });

  it("allows alternate curriculum codes when candidate text supports the requested topic", async () => {
    const alternateIntent: Intent = {
      ...intent,
      objective_code: "9수04-18",
    };
    const result = await mapObjective(
      {},
      {
        request,
        refs,
        candidate: { ...candidate, inferred_intent: alternateIntent },
        intent: alternateIntent,
        strategy: null,
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("allows expression-calculation aliases for polynomial simplification candidates", async () => {
    const expressionRequest: GenerateRequest = {
      ...request,
      grade: 2,
      topic: "9수02-05",
      topic_name: "식의 계산",
      source_problem_text: "지수법칙과 다항식의 곱셈 · 나눗셈을 이해한다.",
    };
    const alternateIntent: Intent = {
      ...intent,
      objective_code: "9수02-01",
      objective_description: "문자를 사용하여 식을 나타낸다.",
    };

    const result = await mapObjective(
      {},
      {
        request: expressionRequest,
        refs,
        candidate: {
          ...candidate,
          generation_kind: "expression",
          question_text: "다음 중 정리했을 때 이차식이 아닌 것은?",
          proposed_solution_trace: "각 다항식을 정리하여 이차식인지 확인한다.",
          inferred_intent: alternateIntent,
        },
        intent: alternateIntent,
        strategy: null,
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("allows variable-expression aliases for expression value candidates", async () => {
    const variableRequest: GenerateRequest = {
      ...request,
      grade: 1,
      topic: "9수02-01",
      topic_name: "문자의 사용과 식의 값",
      source_problem_text: "문자를 사용하여 수량 관계를 식으로 나타낸다.",
    };
    const alternateIntent: Intent = {
      ...intent,
      objective_code: "9수01-01",
      objective_description: "수와 연산",
    };

    const result = await mapObjective(
      {},
      {
        request: variableRequest,
        refs,
        candidate: {
          ...candidate,
          generation_kind: "expression",
          question_text: "a=2 sqrt(7)+3 sqrt(2), b=2 sqrt(7)-3 sqrt(2)일 때 a^2+b^2의 값은?",
          proposed_solution_trace: "문자 a, b에 식을 대입하여 식의 값을 계산한다.",
          inferred_intent: alternateIntent,
        },
        intent: alternateIntent,
        strategy: null,
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("allows rational arithmetic aliases for expression calculation candidates", async () => {
    const arithmeticRequest: GenerateRequest = {
      ...request,
      grade: 1,
      topic: "9수01-03",
      topic_name: "유리수의 사칙연산",
      source_problem_text: "유리수의 사칙계산의 원리를 이해하고 계산할 수 있다.",
    };
    const broadIntent: Intent = {
      ...intent,
      objective_code: "9수01-01",
      objective_description: "수와 연산",
    };

    const result = await mapObjective(
      {},
      {
        request: arithmeticRequest,
        refs,
        candidate: {
          ...candidate,
          generation_kind: "expression",
          question_text: "다음 식의 값을 구하시오. ((-3/4)+(5/6))/(-7/12)-1/2",
          proposed_solution_trace: "유리수의 덧셈, 나눗셈, 뺄셈 순서로 계산한다.",
          inferred_intent: broadIntent,
        },
        intent: broadIntent,
        strategy: null,
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("allows integer-and-rational aliases for rational comparison candidates", async () => {
    const rationalRequest: GenerateRequest = {
      ...request,
      grade: 1,
      topic: "9수01-02",
      topic_name: "정수와 유리수",
      source_problem_text: "정수와 유리수의 뜻을 알고 대소 관계를 판단한다.",
    };
    const broadIntent: Intent = {
      ...intent,
      objective_code: "9수01-01",
      objective_description: "수와 연산",
    };

    const result = await mapObjective(
      {},
      {
        request: rationalRequest,
        refs,
        candidate: {
          ...candidate,
          generation_kind: "expression",
          question_text: "다음 중 옳은 것은? ① -7/5 > -1.3 ② 0.2 < 1/6 ③ -3.8 < -19/5 ④ -2.4 > -5/2 ⑤ 3/4 < 0.7",
          proposed_solution_trace: "음수와 양수인 유리수를 각각 같은 형태로 바꾸어 대소 관계를 비교한다.",
          inferred_intent: broadIntent,
        },
        intent: broadIntent,
        strategy: null,
      },
    );

    expect(result.gate.status).toBe("passed");
  });

  it("allows radical-expression aliases for square-root calculation candidates", async () => {
    const radicalRequest: GenerateRequest = {
      ...request,
      grade: 3,
      topic: "9수01-06",
      topic_name: "근호를 포함한 식의 계산",
      source_problem_text: "근호를 포함한 식의 사칙계산을 할 수 있다.",
    };
    const broadIntent: Intent = {
      ...intent,
      objective_code: "9수01-05",
      objective_description: "제곱근과 실수를 이해한다.",
    };

    const result = await mapObjective(
      {},
      {
        request: radicalRequest,
        refs,
        candidate: {
          ...candidate,
          generation_kind: "expression",
          question_text: "x = (sqrt(5)-1)/(sqrt(5)+1) 일 때, x**2 + 1/x**2 의 값을 구하시오.",
          proposed_solution_trace: "분모를 유리화하고 근호를 포함한 식을 정리하여 값을 계산한다.",
          inferred_intent: broadIntent,
        },
        intent: broadIntent,
        strategy: null,
      },
    );

    expect(result.gate.status).toBe("passed");
  });
});
