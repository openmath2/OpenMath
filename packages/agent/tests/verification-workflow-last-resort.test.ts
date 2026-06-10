import { MockLanguageModelV1 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import type {
  ConstraintCriticAgent,
  GeneratorAgent,
  RefinerAgent,
  SolverAgent,
} from "../src/agents/index.js";
import type {
  GenerateRequest,
  GeneratedProblem,
  ProgressEvent,
  RagResult,
  Strategy,
} from "../src/schemas/index.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";
import type { PromptLoader } from "../src/tools/prompt-loader.js";
import type { RagClient } from "../src/tools/rag-client.js";
import type { StrategyLoader } from "../src/tools/schema-loader.js";
import { runVerificationWorkflow } from "../src/workflows/verification-workflow.js";

const request: GenerateRequest = {
  grade: 3,
  topic: "9수02-10",
  topic_name: "이차방정식의 활용",
  mode: "structural",
  school_level: "middle",
  dims: ["활용"],
  count: 5,
  difficulty: "medium",
  problem_type: "objective",
};

const strategy: Strategy = {
  code: "9수02-10",
  title: "이차방정식의 활용",
  school_level: "middle",
  grade: 3,
  techniques: {
    required_at_least_one_of: ["quadratic_equation"],
    forbidden: [],
  },
  evaluation_dimensions: [{ id: "A", description: "활용", must_preserve: true }],
  difficulty_range: ["medium"],
  problem_types_supported: ["objective"],
  structural_transforms: [{ kind: "coefficient_swap", range: [1, 9], exclude_zero: true }],
  conceptual_transforms: [],
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
      question_text: "가로가 세로보다 3cm 긴 직사각형의 넓이가 10cm^2이다.",
      answer_text: "2cm, 5cm",
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

const critic: ConstraintCriticAgent = {
  critique: async () => ({ passes: true, hints: [] }),
};

const refiner: RefinerAgent = {
  refine: async (input) => input.prior,
};

const solver: SolverAgent = {
  solve: async (candidate) => ({
    derived_answer: candidate.expected_answer,
    trace: "독립 풀이가 같은 답을 얻었다.",
    confidence: "high",
  }),
};

const mathEngine: MathEngineClient = {
  health: async () => ({ status: "ok", engine: "sympy" }),
  solve: async () => ({ solutions: ["2", "3"] }),
  verify: async () => ({ equivalent: true, diff: "0" }),
  simplify: async ({ expr }) => ({ simplified: expr }),
  differentiate: async () => ({ derivative: "" }),
  limit: async () => ({ limit: "" }),
};

const rag: RagClient = {
  search: async () => refs,
};

const prompts: PromptLoader = {
  load: async (id) => {
    throw new Error(`prompt ${id} is not used in workflow last-resort tests`);
  },
};

const strategies: StrategyLoader = {
  load: async () => strategy,
  loadAll: async () => [strategy],
};

describe("runVerificationWorkflow last-resort deterministic fallback", () => {
  it("emits the deterministic template only after retries are exhausted", async () => {
    const generate = vi.fn<GeneratorAgent["generate"]>(async (input) =>
      makeCandidate({
        attempt: input.attempt,
        candidateId: candidateId(200 + input.attempt),
        generationKind: "geometry",
        questionText: "원 O에서 중심각 AOB가 80도일 때 원주각 ACB의 크기를 구하시오.",
        expectedAnswer: "40도",
        model: "llm-test-model",
      }),
    );

    const result = await runToResult({ generate }, { maxRetries: 2 });
    const problem = result.candidates[0]?.problem;
    const verification = result.candidates[0]?.verification;

    expect(generate).toHaveBeenCalledTimes(2);
    expect(problem?.generation_metadata.model).toBe("deterministic-topic-generator");
    expect(problem?.generation_metadata.refined_by ?? []).toContain("deterministic-topic-generator");
    expect(problem?.question_text).toContain("직사각형");
    expect(verification?.candidate_id).toBe(problem?.candidate_id);
    expect(verification?.overall).toBe("rejected");
  });

  it("does not use the deterministic template when the LLM candidate verifies", async () => {
    const generate = vi.fn<GeneratorAgent["generate"]>(async (input) =>
      makeCandidate({
        attempt: input.attempt,
        candidateId: candidateId(300 + input.attempt),
        generationKind: "equation",
        questionText:
          "다음 중 이차방정식 x^2 - 5x + 6 = 0의 해는? ① 2, 3 ② 1, 6 ③ -2, -3",
        expectedAnswer: "①",
        expectedChoices: ["① 2, 3", "② 1, 6", "③ -2, -3"],
        model: "llm-test-model",
      }),
    );

    const result = await runToResult({ generate }, { maxRetries: 2 });
    const problem = result.candidates[0]?.problem;
    const verification = result.candidates[0]?.verification;

    expect(generate).toHaveBeenCalledTimes(1);
    expect(problem?.generation_metadata.model).toBe("llm-test-model");
    expect(problem?.generation_metadata.refined_by ?? []).not.toContain("deterministic-topic-generator");
    expect(verification?.candidate_id).toBe(problem?.candidate_id);
    expect(verification?.overall).toBe("verified");
  });
});

async function runToResult(
  generator: GeneratorAgent,
  options: { readonly maxRetries: number },
): Promise<Extract<ProgressEvent, { type: "result" }>> {
  const events: ProgressEvent[] = [];
  for await (const event of runVerificationWorkflow(
    {
      rag,
      mathEngine,
      prompts,
      strategies,
      intentModel: new MockLanguageModelV1(),
      generator,
      critic,
      refiner,
      solver,
    },
    request,
    {
      deterministicFallback: "last-resort",
      maxRetries: options.maxRetries,
      perStepTimeoutMs: 1_000,
    },
  )) {
    events.push(event);
  }

  const result = events.find((event) => event.type === "result");
  if (result === undefined) {
    throw new Error("workflow did not emit a result event");
  }
  if (result.type !== "result") {
    throw new Error(`expected result event, got ${result.type}`);
  }
  return result;
}

function makeCandidate(input: {
  readonly attempt: number;
  readonly candidateId: string;
  readonly generationKind: GeneratedProblem["generation_kind"];
  readonly questionText: string;
  readonly expectedAnswer: string;
  readonly expectedChoices?: string[];
  readonly model: string;
}): GeneratedProblem {
  return {
    candidate_id: input.candidateId,
    mode: "structural",
    generation_kind: input.generationKind,
    question_text: input.questionText,
    expected_answer: input.expectedAnswer,
    expected_choices: input.expectedChoices,
    techniques_used: strategy.techniques.required_at_least_one_of,
    proposed_solution_trace: "후보 풀이 trace",
    source_refs: ["ref-1"],
    inferred_intent: {
      objective_code: strategy.code,
      objective_description: strategy.title,
      evaluation_dimensions: strategy.evaluation_dimensions,
      required_techniques: strategy.techniques.required_at_least_one_of,
      forbidden_techniques: strategy.techniques.forbidden,
      surface_constraints: {
        difficulty: request.difficulty,
        problem_type: request.problem_type,
      },
    },
    generation_metadata: {
      model: input.model,
      temperature: 0,
      prompt_id: "problem-generator",
      prompt_version: "0.0.0",
      attempt: input.attempt,
      generated_at: "2026-06-10T00:00:00.000Z",
    },
  };
}

function candidateId(value: number): string {
  return `00000000-0000-0000-0000-${String(value).padStart(12, "0")}`;
}
