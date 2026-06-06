import { describe, expect, it } from "vitest";

import type { GenerateRequest, Intent, RagResult } from "../src/schemas/index.js";
import { deterministicInitialCandidate } from "../src/steps/problem-generation-deterministic.js";

const intent: Intent = {
  objective_code: "9수05-01",
  objective_description: "자료의 정리와 해석",
  evaluation_dimensions: [{ id: "A", description: "상대도수", must_preserve: true }],
  required_techniques: ["relative_frequency"],
  forbidden_techniques: [],
  surface_constraints: { difficulty: "medium", problem_type: "objective" },
};

const request: GenerateRequest = {
  grade: 1,
  topic: "9수05-01",
  topic_name: "자료의 정리와 해석",
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
      grade: 1,
      semester: null,
      topic_code: "9수05-01",
      topic_name: "자료의 정리와 해석",
      achievement_standard: "자료를 정리하고 해석한다.",
      question_text: "상대도수를 구하시오.",
      answer_text: "1/5",
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

describe("deterministicInitialCandidate", () => {
  it("creates a topic-aligned deterministic candidate for known unstable topics", () => {
    const candidate = deterministicInitialCandidate({
      request,
      intent,
      refs,
      attempt: 1,
    });

    expect(candidate?.generation_kind).toBe("statistics");
    expect(candidate?.source_refs).toEqual(["ref-1"]);
    expect(candidate?.question_text).toContain("상대도수");
  });

  it("returns null for topics that do not need deterministic generation", () => {
    const candidate = deterministicInitialCandidate({
      request: { ...request, topic: "9수99-99" },
      intent,
      refs: [],
      attempt: 1,
    });

    expect(candidate).toBeNull();
  });

  it("creates a stable circle-angle candidate for the circle theorem topic", () => {
    const candidate = deterministicInitialCandidate({
      request: { ...request, topic: "9수04-07", topic_name: "원주각" },
      intent: { ...intent, objective_code: "9수04-07", objective_description: "원주각을 이해한다." },
      refs,
      attempt: 1,
    });

    expect(candidate?.generation_kind).toBe("geometry");
    expect(candidate?.question_text).toContain("중심각");
    expect(candidate?.expected_answer).toBe("40도");
  });

  it("creates a stable linear-expression calculation candidate", () => {
    const candidate = deterministicInitialCandidate({
      request: { ...request, topic: "9수02-02", topic_name: "일차식의 계산" },
      intent: { ...intent, objective_code: "9수02-02", objective_description: "일차식을 계산한다." },
      refs,
      attempt: 1,
    });

    expect(candidate?.generation_kind).toBe("expression");
    expect(candidate?.question_text).toContain("일차식");
    expect(candidate?.expected_answer).toBe("4x - 11");
  });

  it("creates stable linear-function candidates for graph and application topics", () => {
    const graphCandidate = deterministicInitialCandidate({
      request: { ...request, topic: "9수03-02", topic_name: "일차함수와 그래프" },
      intent: { ...intent, objective_code: "9수03-02", objective_description: "일차함수의 그래프를 이해한다." },
      refs,
      attempt: 1,
    });
    const applicationCandidate = deterministicInitialCandidate({
      request: { ...request, topic: "9수03-03", topic_name: "일차함수의 활용" },
      intent: { ...intent, objective_code: "9수03-03", objective_description: "일차함수를 활용한다." },
      refs,
      attempt: 1,
    });

    expect(graphCandidate?.generation_kind).toBe("function");
    expect(graphCandidate?.expected_answer).toBe("(0, -3)");
    expect(applicationCandidate?.generation_kind).toBe("function");
    expect(applicationCandidate?.expected_answer).toBe("1000x + 3000, 8000원");
  });

  it("creates a stable quadratic-equation application candidate", () => {
    const candidate = deterministicInitialCandidate({
      request: { ...request, topic: "9수02-10", topic_name: "이차방정식의 활용" },
      intent: { ...intent, objective_code: "9수02-10", objective_description: "이차방정식을 활용한다." },
      refs,
      attempt: 1,
    });

    expect(candidate?.generation_kind).toBe("equation");
    expect(candidate?.question_text).toContain("직사각형");
    expect(candidate?.expected_answer).toBe("2cm, 5cm");
  });

  it("creates a stable linear-equation application candidate", () => {
    const candidate = deterministicInitialCandidate({
      request: { ...request, topic: "9수02-04", topic_name: "일차방정식의 활용" },
      intent: { ...intent, objective_code: "9수02-04", objective_description: "일차방정식을 활용한다." },
      refs,
      attempt: 1,
    });

    expect(candidate?.generation_kind).toBe("equation");
    expect(candidate?.question_text).toContain("입장권");
    expect(candidate?.expected_answer).toBe("5000원");
  });

  it("creates a stable triangle-property candidate", () => {
    const candidate = deterministicInitialCandidate({
      request: { ...request, topic: "9수04-02", topic_name: "삼각형의 성질" },
      intent: { ...intent, objective_code: "9수04-02", objective_description: "삼각형의 성질을 이해한다." },
      refs,
      attempt: 1,
    });

    expect(candidate?.generation_kind).toBe("geometry");
    expect(candidate?.question_text).toContain("AB = AC");
    expect(candidate?.expected_answer).toBe("70도");
  });

  it("creates stable candidates for remaining stochastic algebra and function topics", () => {
    const repeatingDecimal = deterministicInitialCandidate({
      request: { ...request, topic: "9수01-04", topic_name: "유리수와 순환소수" },
      intent,
      refs,
      attempt: 1,
    });
    const system = deterministicInitialCandidate({
      request: { ...request, topic: "9수02-07", topic_name: "연립일차방정식" },
      intent,
      refs,
      attempt: 1,
    });
    const quadraticFunction = deterministicInitialCandidate({
      request: { ...request, topic: "9수03-04", topic_name: "이차함수와 그래프" },
      intent,
      refs,
      attempt: 1,
    });

    expect(repeatingDecimal?.expected_answer).toBe("4/33");
    expect(system?.expected_answer).toBe("x=3, y=2");
    expect(quadraticFunction?.expected_answer).toBe("아래로 열린다");
  });

  it("creates a stable integer-and-rational comparison candidate", () => {
    const candidate = deterministicInitialCandidate({
      request: { ...request, topic: "9수01-02", topic_name: "정수와 유리수" },
      intent,
      refs,
      attempt: 1,
    });

    expect(candidate?.expected_answer).toBe("-3/4 < -2/3");
  });

  it("creates a stable square-root candidate", () => {
    const candidate = deterministicInitialCandidate({
      request: { ...request, topic: "9수01-05", topic_name: "제곱근과 실수" },
      intent,
      refs,
      attempt: 1,
    });

    expect(candidate?.expected_answer).toBe("9, -9");
  });

  it("creates a stable quadrilateral-property candidate", () => {
    const candidate = deterministicInitialCandidate({
      request: { ...request, topic: "9수04-03", topic_name: "사각형의 성질" },
      intent,
      refs,
      attempt: 1,
    });

    expect(candidate?.expected_answer).toBe("10cm");
  });

  it("creates stable circle-position and probability candidates", () => {
    const circlePosition = deterministicInitialCandidate({
      request: { ...request, topic: "9수04-06", topic_name: "원과 직선의 위치 관계" },
      intent,
      refs,
      attempt: 1,
    });
    const probability = deterministicInitialCandidate({
      request: { ...request, topic: "9수05-02", topic_name: "경우의 수와 확률" },
      intent,
      refs,
      attempt: 1,
    });

    expect(circlePosition?.expected_answer).toBe("한 점에서 만난다");
    expect(probability?.expected_answer).toBe("1/2");
  });

  it("creates stable prime-factorization and radical-expression candidates", () => {
    const primeFactorization = deterministicInitialCandidate({
      request: { ...request, topic: "9수01-01", topic_name: "소인수분해" },
      intent,
      refs,
      attempt: 1,
    });
    const radicalExpression = deterministicInitialCandidate({
      request: { ...request, topic: "9수01-06", topic_name: "근호를 포함한 식의 계산" },
      intent,
      refs,
      attempt: 1,
    });

    expect(primeFactorization?.expected_answer).toBe("2^2 * 3");
    expect(radicalExpression?.expected_answer).toBe("5sqrt(2)");
  });
});
