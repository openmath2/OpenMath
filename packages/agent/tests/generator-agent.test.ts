import type { LanguageModel } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGeneratorAgent,
  temperatureForGeneratorAttempt,
} from "../src/agents/generator-agent.js";
import type { GenerateRequest, Intent } from "../src/schemas/index.js";
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
  source_problem_text: "x**2 - 5*x + 6 = 0의 해를 구하시오.",
};

const intent: Intent = {
  objective_code: "9수02-10",
  objective_description: "이차방정식을 활용하여 문제를 해결한다.",
  evaluation_dimensions: [{ id: "A", description: "이차방정식 활용", must_preserve: true }],
  required_techniques: ["quadratic_equation"],
  forbidden_techniques: [],
  surface_constraints: { difficulty: "medium", problem_type: "objective" },
};

const modelObject = {
  question_text: "다음 방정식을 풀어라. x**2 - 7*x + 12 = 0",
  expected_answer: "3, 4",
  proposed_solution_trace: "인수분해하여 두 근을 구한다.",
};

beforeEach(() => {
  aiMock.generateObject.mockReset();
});

describe("temperatureForGeneratorAttempt", () => {
  it("escalates and clamps the attempt temperature schedule", () => {
    expect(temperatureForGeneratorAttempt(1)).toBe(0.35);
    expect(temperatureForGeneratorAttempt(2)).toBe(0.6);
    expect(temperatureForGeneratorAttempt(3)).toBe(0.85);
    expect(temperatureForGeneratorAttempt(4)).toBe(0.85);
  });
});

describe("createGeneratorAgent", () => {
  it("passes the scheduled temperature into generateObject", async () => {
    aiMock.generateObject.mockResolvedValue({ object: modelObject });
    const render = vi.fn(() => "rendered prompt");
    const agent = createGeneratorAgent({
      model: {} as LanguageModel,
      modelId: "test-model",
      promptId: "problem-generator",
      prompts: promptLoader(render),
    });

    const generated = await agent.generate({
      request,
      intent,
      refs: [],
      strategy: null,
      attempt: 2,
    });

    expect(generated.generation_metadata.temperature).toBe(0.6);
    expect(generated.techniques_used).toEqual([]);
    expect(aiMock.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.6 }),
    );
  });

  it("passes the LLM verification expression through to the generated problem", async () => {
    aiMock.generateObject.mockResolvedValue({
      object: { ...modelObject, verification_expression: "factorial(3)*factorial(4)" },
    });
    const agent = createGeneratorAgent({
      model: {} as LanguageModel,
      modelId: "test-model",
      promptId: "problem-generator",
      prompts: promptLoader(vi.fn(() => "rendered prompt")),
    });

    const generated = await agent.generate({
      request,
      intent,
      refs: [],
      strategy: null,
      attempt: 1,
    });

    expect(generated.verification_expression).toBe("factorial(3)*factorial(4)");
  });

  it("omits verification_expression when the LLM does not provide one", async () => {
    aiMock.generateObject.mockResolvedValue({ object: modelObject });
    const agent = createGeneratorAgent({
      model: {} as LanguageModel,
      modelId: "test-model",
      promptId: "problem-generator",
      prompts: promptLoader(vi.fn(() => "rendered prompt")),
    });

    const generated = await agent.generate({
      request,
      intent,
      refs: [],
      strategy: null,
      attempt: 1,
    });

    expect(generated.verification_expression).toBeUndefined();
    expect("verification_expression" in generated).toBe(false);
  });

  it("immediately retries a schema failure once with a schema hint", async () => {
    const schemaError = new Error("question_text is required");
    schemaError.name = "NoObjectGeneratedError";
    aiMock.generateObject
      .mockRejectedValueOnce(schemaError)
      .mockResolvedValueOnce({ object: modelObject });
    const render = vi.fn((vars: Record<string, unknown>) => JSON.stringify(vars));
    const agent = createGeneratorAgent({
      model: {} as LanguageModel,
      modelId: "test-model",
      promptId: "problem-generator",
      prompts: promptLoader(render),
    });

    const generated = await agent.generate({
      request,
      intent,
      refs: [],
      strategy: null,
      attempt: 1,
    });

    expect(generated.question_text).toBe(modelObject.question_text);
    expect(aiMock.generateObject).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenCalledTimes(2);
    expect(render.mock.calls[1]?.[0]).toMatchObject({
      schemaError: "question_text is required",
    });
    expect(aiMock.generateObject.mock.calls[1]?.[0]).toMatchObject({
      prompt: expect.stringContaining("question_text is required"),
    });
  });
});

function promptLoader(render: LoadedPrompt["render"]): PromptLoader {
  return {
    load: async () => ({
      metadata: {
        id: "problem-generator",
        version: "0.1.1",
        model: "test-model",
        temperature: 0.35,
        max_tokens: 2000,
        schema: "GeneratedProblemSchema",
        variables: ["request", "intent", "refs", "strategy", "refinementHint"],
        owner: "비할당",
        updated: "2026-06-10",
      },
      rawBody: "",
      render,
    }),
  };
}
