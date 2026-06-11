import { describe, expect, it, vi } from "vitest";

import type {
  ConstraintCriticAgent,
  GeneratorAgent,
  RefinerAgent,
} from "../src/agents/index.js";
import { EnvSchema } from "../src/config/env.js";
import type { GenerateRequest, GeneratedProblem, Intent, RagResult } from "../src/schemas/index.js";
import { generateProblem } from "../src/steps/problem-generation.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";

const intent: Intent = {
  objective_code: "9수02-10",
  objective_description: "이차방정식을 활용하여 문제를 해결한다.",
  evaluation_dimensions: [{ id: "A", description: "활용", must_preserve: true }],
  required_techniques: ["quadratic_equation"],
  forbidden_techniques: [],
  surface_constraints: { difficulty: "medium", problem_type: "objective" },
};

const request: GenerateRequest = {
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

const llmCandidate: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000099",
  mode: "structural",
  generation_kind: "equation",
  question_text: "LLM이 직접 생성한 문제. x^2 - 5x + 6 = 0",
  expected_answer: "2, 3",
  techniques_used: ["quadratic_equation"],
  proposed_solution_trace: "LLM이 풀이를 작성한다.",
  source_refs: ["ref-1"],
  inferred_intent: intent,
  generation_metadata: {
    model: "llm-test-model",
    temperature: 0,
    prompt_id: "problem-generator",
    prompt_version: "0.0.0",
    attempt: 1,
    generated_at: "2026-06-06T00:00:00.000Z",
  },
};

const critic: ConstraintCriticAgent = {
  critique: async () => ({ passes: true, hints: [] }),
};

const refiner: RefinerAgent = {
  refine: async () => llmCandidate,
};

const mathEngine: MathEngineClient = {
  health: async () => ({ status: "ok", engine: "sympy" }),
  solve: async () => {
    throw new Error("math-engine rejected extracted equation");
  },
  verify: async () => ({ equivalent: true, diff: "0" }),
  simplify: async ({ expr }) => ({ simplified: expr }),
  evaluate: async () => ({ value: "", numeric: "" }),
  differentiate: async () => ({ derivative: "" }),
  limit: async () => ({ limit: "" }),
};

function makeGenerator(): { agent: GeneratorAgent; spy: ReturnType<typeof vi.fn> } {
  const spy = vi.fn(async () => llmCandidate);
  return { agent: { generate: spy }, spy };
}

describe("DETERMINISTIC_FALLBACK env parsing", () => {
  it("defaults to 'first' when unset", () => {
    const parsed = EnvSchema.parse({});
    expect(parsed.DETERMINISTIC_FALLBACK).toBe("first");
  });

  it("accepts 'off'", () => {
    const parsed = EnvSchema.parse({ DETERMINISTIC_FALLBACK: "off" });
    expect(parsed.DETERMINISTIC_FALLBACK).toBe("off");
  });

  it("accepts 'last-resort'", () => {
    const parsed = EnvSchema.parse({ DETERMINISTIC_FALLBACK: "last-resort" });
    expect(parsed.DETERMINISTIC_FALLBACK).toBe("last-resort");
  });

  it("accepts 'first'", () => {
    const parsed = EnvSchema.parse({ DETERMINISTIC_FALLBACK: "first" });
    expect(parsed.DETERMINISTIC_FALLBACK).toBe("first");
  });

  it("rejects unknown values", () => {
    expect(() => EnvSchema.parse({ DETERMINISTIC_FALLBACK: "always" })).toThrow();
  });
});

describe("generateProblem deterministicFallback behavior", () => {
  it("uses the deterministic template when mode='first' and refs exist", async () => {
    const { agent: generator, spy } = makeGenerator();

    const result = await generateProblem(
      { generator, critic, refiner, mathEngine },
      { request, intent, refs, strategy: null, attempt: 1, deterministicFallback: "first" },
    );

    expect(spy).not.toHaveBeenCalled();
    expect(result.refined_by).toContain("deterministic-topic-generator");
    expect(result.data?.generation_metadata.model).toBe("deterministic-topic-generator");
    expect(result.gate.status).toBe("passed");
  });

  it("preserves 'first' behavior when deterministicFallback is omitted (default)", async () => {
    const { agent: generator, spy } = makeGenerator();

    const result = await generateProblem(
      { generator, critic, refiner, mathEngine },
      { request, intent, refs, strategy: null, attempt: 1 },
    );

    expect(spy).not.toHaveBeenCalled();
    expect(result.data?.generation_metadata.model).toBe("deterministic-topic-generator");
  });

  it("skips the deterministic template when mode='off' (goes through LLM generator)", async () => {
    const { agent: generator, spy } = makeGenerator();

    const result = await generateProblem(
      { generator, critic, refiner, mathEngine },
      { request, intent, refs, strategy: null, attempt: 1, deterministicFallback: "off" },
    );

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.refined_by).not.toContain("deterministic-topic-generator");
    expect(result.data?.generation_metadata.model).toBe("llm-test-model");
    expect(result.data?.candidate_id).toBe(llmCandidate.candidate_id);
  });

  it("skips the deterministic template up-front when mode='last-resort'", async () => {
    const { agent: generator, spy } = makeGenerator();

    const result = await generateProblem(
      { generator, critic, refiner, mathEngine },
      {
        request,
        intent,
        refs,
        strategy: null,
        attempt: 1,
        deterministicFallback: "last-resort",
      },
    );

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.refined_by).not.toContain("deterministic-topic-generator");
    expect(result.data?.generation_metadata.model).toBe("llm-test-model");
    expect(result.data?.candidate_id).toBe(llmCandidate.candidate_id);
  });
});
