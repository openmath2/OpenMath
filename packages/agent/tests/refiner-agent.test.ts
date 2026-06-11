import type { LanguageModel } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRefinerAgent } from "../src/agents/refiner-agent.js";
import type { GenerateRequest, GeneratedProblem, Intent } from "../src/schemas/index.js";
import type { LoadedPrompt, PromptLoader } from "../src/tools/prompt-loader.js";

const aiMock = vi.hoisted(() => ({
  generateObject: vi.fn(),
  NoObjectGeneratedError: {
    isInstance(error: unknown) {
      return error instanceof Error && error.name === "NoObjectGeneratedError";
    },
  },
}));

vi.mock("ai", () => ({
  generateObject: aiMock.generateObject,
  NoObjectGeneratedError: aiMock.NoObjectGeneratedError,
}));

const request: GenerateRequest = {
  grade: 3,
  topic: "9수02-10",
  topic_name: "이차방정식의 활용",
  mode: "structural",
  school_level: "middle",
  dims: ["A"],
  count: 1,
  difficulty: "medium",
  problem_type: "objective",
};

const intent: Intent = {
  objective_code: "9수02-10",
  objective_description: "이차방정식을 활용하여 문제를 해결한다.",
  evaluation_dimensions: [{ id: "A", description: "이차방정식 활용", must_preserve: true }],
  required_techniques: ["quadratic_equation"],
  forbidden_techniques: [],
  surface_constraints: { difficulty: "medium", problem_type: "objective" },
};

const prior: GeneratedProblem = {
  candidate_id: "00000000-0000-0000-0000-000000000077",
  mode: "structural",
  generation_kind: "equation",
  question_text: "두 수의 곱이 12이고 합이 7일 때 두 수를 구하시오.",
  expected_answer: "3, 4",
  techniques_used: ["quadratic_equation"],
  proposed_solution_trace: "x(7 - x) = 12를 풀어 두 수를 구한다.",
  source_refs: ["ref-1"],
  inferred_intent: intent,
  generation_metadata: {
    model: "test-model",
    temperature: 0.35,
    prompt_id: "problem-generator",
    prompt_version: "0.1.2",
    attempt: 2,
    generated_at: "2026-06-11T00:00:00.000Z",
  },
};

const refinedObject = {
  question_text: "두 자연수의 곱이 20이고 합이 9일 때 두 수를 구하시오.",
  expected_answer: "4, 5",
  techniques_used: ["quadratic_equation"],
  proposed_solution_trace: "x(9 - x) = 20을 정리해 이차방정식으로 푼다.",
};

beforeEach(() => {
  aiMock.generateObject.mockReset();
});

describe("createRefinerAgent", () => {
  it("refines via its own prompt with prior + hints (not a blank regeneration)", async () => {
    aiMock.generateObject.mockResolvedValue({ object: refinedObject });
    const render = vi.fn((vars: Record<string, unknown>) => JSON.stringify(vars));
    const agent = createRefinerAgent({
      model: {} as LanguageModel,
      modelId: "test-model",
      promptId: "refiner",
      prompts: promptLoader(render),
    });

    const refined = await agent.refine({
      prior,
      request,
      intent,
      refs: [],
      strategy: null,
      attempt: 2,
      hints: ["선택지가 없는데 객관식으로 서술돼 있다"],
    });

    expect(refined.question_text).toBe(refinedObject.question_text);
    expect(refined.generation_metadata.prompt_id).toBe("refiner");
    expect(refined.generation_metadata.model).toBe("test-model");
    expect(refined.generation_metadata.temperature).toBe(0.5);
    expect(refined.generation_metadata.attempt).toBe(2);
    expect(refined.inferred_intent.objective_code).toBe(intent.objective_code);

    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0]?.[0]).toMatchObject({
      prior,
      hints: ["선택지가 없는데 객관식으로 서술돼 있다"],
    });
    expect(aiMock.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.5 }),
    );
  });

  it("retries once with a schema hint when the model output fails validation", async () => {
    const schemaError = new Error("expected_answer is required");
    schemaError.name = "NoObjectGeneratedError";
    aiMock.generateObject
      .mockRejectedValueOnce(schemaError)
      .mockResolvedValueOnce({ object: refinedObject });
    const render = vi.fn((vars: Record<string, unknown>) => JSON.stringify(vars));
    const agent = createRefinerAgent({
      model: {} as LanguageModel,
      modelId: "test-model",
      promptId: "refiner",
      prompts: promptLoader(render),
    });

    const refined = await agent.refine({
      prior,
      request,
      intent,
      refs: [],
      strategy: null,
      attempt: 1,
      hints: ["정답 표기를 plain text로"],
    });

    expect(refined.expected_answer).toBe(refinedObject.expected_answer);
    expect(aiMock.generateObject).toHaveBeenCalledTimes(2);
    expect(render.mock.calls[1]?.[0]).toMatchObject({
      schemaError: "expected_answer is required",
    });
  });
});

function promptLoader(render: LoadedPrompt["render"]): PromptLoader {
  return {
    load: async (id) => ({
      metadata: {
        id,
        version: "0.2.0",
        model: "test-model",
        temperature: 0.5,
        max_tokens: 2000,
        schema: "GeneratedProblemSchema",
        variables: ["prior", "request", "intent", "refs", "strategy", "hints"],
        owner: "비할당",
        updated: "2026-06-11",
      },
      rawBody: "",
      render,
    }),
  };
}
