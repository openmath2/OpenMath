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
  count: 1,
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
    trace: "독립 풀이",
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

const rag: RagClient = { search: async () => refs };

const prompts: PromptLoader = {
  load: async (id) => {
    throw new Error(`prompt ${id} is not used in this test`);
  },
};

const strategies: StrategyLoader = {
  load: async () => strategy,
  loadAll: async () => [strategy],
};

async function collectEvents(
  generator: GeneratorAgent,
  deterministicFallback: "off" | "last-resort",
  maxRetries: number,
): Promise<ProgressEvent[]> {
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
    { deterministicFallback, maxRetries, perStepTimeoutMs: 1_000 },
  )) {
    events.push(event);
  }
  return events;
}

describe("runVerificationWorkflow when generation itself fails", () => {
  it("degrades to a failed gate, retries, then falls back to the deterministic template (last-resort)", async () => {
    const generate = vi.fn<GeneratorAgent["generate"]>(async () => {
      throw new Error("LLM provider unreachable");
    });

    const events = await collectEvents({ generate }, "last-resort", 2);

    expect(generate).toHaveBeenCalledTimes(2);

    const retries = events.filter((event) => event.type === "retry");
    expect(retries).toHaveLength(1);
    expect(retries[0]).toMatchObject({ attempt: 2, max_attempts: 2 });

    const result = events.find((event) => event.type === "result");
    expect(result).toBeDefined();
    if (result?.type !== "result") throw new Error("expected result event");
    const candidate = result.candidates[0];
    expect(candidate?.problem.generation_metadata.model).toBe("deterministic-topic-generator");
    expect(candidate?.verification.overall).toBe("rejected");
    expect(candidate?.verification.gates.map((gate) => [gate.step, gate.status])).toEqual([
      ["rag", "passed"],
      ["intent", "passed"],
      ["generate", "failed"],
      ["sympy_verify", "skipped"],
      ["re_solve", "skipped"],
      ["objective_map", "skipped"],
    ]);
  });

  it("emits a generation_failed error instead of a result when no fallback exists (off)", async () => {
    const generate = vi.fn<GeneratorAgent["generate"]>(async () => {
      throw new Error("LLM provider unreachable");
    });

    const events = await collectEvents({ generate }, "off", 2);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(events.find((event) => event.type === "result")).toBeUndefined();
    const error = events.find((event) => event.type === "error");
    expect(error).toMatchObject({
      type: "error",
      stage: "generate",
      code: "generation_failed",
      recoverable: false,
    });
  });

  it("does not emit preview events for failed generations", async () => {
    const generate = vi.fn<GeneratorAgent["generate"]>(async () => {
      throw new Error("LLM provider unreachable");
    });

    const events = await collectEvents({ generate }, "off", 1);

    expect(events.filter((event) => event.type === "preview")).toHaveLength(0);
  });
});
