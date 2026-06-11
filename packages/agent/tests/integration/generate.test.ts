import { describe, expect, it, vi } from "vitest";
import type { LanguageModel } from "ai";

import type {
  ConstraintCriticAgent,
  GeneratorAgent,
  RefinerAgent,
  SolverAgent,
} from "../../src/agents/index.js";
import { createApp } from "../../src/server/app.js";
import type {
  GenerateRequest,
  GeneratedProblem,
  Intent,
  RagResult,
  SourceProblem,
  Strategy,
  WireSseEvent,
} from "../../src/schemas/index.js";
import type { MathEngineClient, PromptLoader, RagClient, StrategyLoader } from "../../src/tools/index.js";

const intent: Intent = {
  objective_code: "9수02-09",
  objective_description: "이차방정식을 풀 수 있다",
  evaluation_dimensions: [
    { id: "A", description: "수식 전개", must_preserve: true },
    { id: "B", description: "해 검증", must_preserve: true },
  ],
  required_techniques: ["factorization"],
  forbidden_techniques: [],
  surface_constraints: { difficulty: "medium", problem_type: "objective" },
};

vi.mock("ai", () => ({
  generateObject: vi.fn(async () => ({ object: intent })),
}));

const sourceProblem: SourceProblem = {
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
  question_text: "x**2 - 5*x + 6 = 0",
  answer_text: "2, 3",
  explanation_text: "인수분해한다.",
  choice_blocks: null,
  problem_type_norm: "objective",
  difficulty_norm: "medium",
  question_image_relpath: null,
  answer_image_relpath: null,
  question_json_relpath: null,
  answer_json_relpath: null,
};

const strategy: Strategy = {
  code: "9수02-09",
  title: "이차방정식",
  difficulty_range: ["easy", "medium", "hard"],
  problem_types_supported: ["objective", "short_answer"],
  evaluation_dimensions: intent.evaluation_dimensions,
  techniques: { required_at_least_one_of: ["factorization"], forbidden: [] },
  structural_transforms: [{ id: "s1", description: "계수 변형" }],
  conceptual_transforms: [],
};

describe("POST /api/generate integration", () => {
  it("streams six completed steps and a passing result", async () => {
    const app = createTestApp({ answer: "2, 5", solverAnswer: "2, 5" });
    const events = await postGenerate(app.fetch);

    // 4(sympy_verify)와 5(re_solve)는 병렬 실행 — 둘 다 시작된 뒤 순서대로 완료된다.
    expect(
      events
        .filter((event) => event.event === "step")
        .map((event) => [event.data.index, event.data.status]),
    ).toEqual([
      [1, "started"], [1, "completed"],
      [2, "started"], [2, "completed"],
      [3, "started"], [3, "completed"],
      [4, "started"], [5, "started"],
      [4, "completed"], [5, "completed"],
      [6, "started"], [6, "completed"],
    ]);
    // preview는 result와 동일하게 formatLatex 적용 후의 문제 본문이 온다.
    const preview = events.find((event) => event.event === "preview");
    expect(preview?.data.latex).toBe("x^{2} - 7 x + 10 = 0");
    const result = events.find((event) => event.event === "result");
    expect(result?.data[0]?.verification_status).toBe("pass");
  });

  it("fans out to count parallel problems merged into one result, one step bar", async () => {
    const app = createTestApp({ answer: "2, 5", solverAnswer: "2, 5" });
    const events = await postGenerate(app.fetch, 3);

    expect(events.filter((event) => event.event === "step")).toHaveLength(12);
    const result = events.find((event) => event.event === "result");
    expect(result?.data[0]?.verification_status).toBe("pass");
    expect(result?.data[2]?.verification_status).toBe("pass");
    expect(result?.data[3]).toBeUndefined();
  });

  it("terminates early with rag error when no refs exist", async () => {
    const app = createTestApp({ refs: [], answer: "2, 5", solverAnswer: "2, 5" });
    const events = await postGenerate(app.fetch);
    const error = events.find((event) => event.event === "error");

    expect(error?.data.stage).toBe("rag");
    expect(events.some((event) => event.event === "result")).toBe(false);
  });

  it("rejects a candidate whose techniques do not match the required techniques", async () => {
    const app = createTestApp({ answer: "2, 5", solverAnswer: "2, 5", techniques: ["quadratic_formula"] });
    const events = await postGenerate(app.fetch);
    const objectiveFailed = events.find(
      (event) => event.event === "step" && event.data.index === 6 && event.data.status === "failed",
    );
    const result = events.find((event) => event.event === "result");

    expect(objectiveFailed).toBeDefined();
    expect(result?.data[0]?.verification_status).toBe("fail");
  });

  it("stops cleanly when aborted mid-stream", async () => {
    const app = createTestApp({ answer: "2, 5", solverAnswer: "2, 5" });
    const controller = new AbortController();
    const response = await app.fetch(generateRequest(), { signal: controller.signal });
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const first = await reader?.read();
    controller.abort();
    await reader?.cancel();
    expect(first?.done).toBe(false);
  });
});

function createTestApp(opts: {
  refs?: RagResult[];
  answer: string;
  solverAnswer: string;
  techniques?: string[];
}): ReturnType<typeof createApp> {
  const refs = opts.refs ?? [{ item_id: "seed-1", similarity: 1, problem: sourceProblem, match_reason: "hybrid" }];
  const generated: GeneratedProblem = {
    candidate_id: "00000000-0000-0000-0000-000000000001",
    mode: "structural",
    generation_kind: "equation",
    question_text: "x**2 - 7*x + 10 = 0",
    expected_answer: opts.answer,
    techniques_used: opts.techniques ?? ["factorization"],
    proposed_solution_trace: "인수분해한다.",
    source_refs: ["seed-1"],
    inferred_intent: intent,
    generation_metadata: {
      model: "fake",
      temperature: 0,
      prompt_id: "problem-generator",
      prompt_version: "0.1.0",
      attempt: 1,
      generated_at: "2026-06-02T00:00:00.000Z",
    },
  };

  const generator: GeneratorAgent = { async generate() { return generated; } };
  const critic: ConstraintCriticAgent = { async critique() { return { passes: true, hints: [] }; } };
  const refiner: RefinerAgent = { async refine(input) { return input.prior; } };
  const solver: SolverAgent = {
    async solve() {
      return { derived_answer: opts.solverAnswer, trace: "독립 풀이", confidence: "high" };
    },
  };

  return createApp({
    mathEngine: fakeMathEngine(),
    workflow: {
      rag: fakeRag(refs),
      mathEngine: fakeMathEngine(),
      prompts: fakePrompts(),
      strategies: fakeStrategies(),
      intentModel: fakeModel(),
      generator,
      critic,
      refiner,
      solver,
    },
    // "off" so the generator mock runs instead of the default template short-circuit.
    workflowOptions: { maxRetries: 1, perStepTimeoutMs: 1000, deterministicFallback: "off" },
  });
}

function generateRequest(count = 1): Request {
  const body: GenerateRequest = {
    grade: 3,
    topic: "9수02-09",
    mode: "structural",
    school_level: "middle",
    dims: ["수식 전개", "해 검증"],
    count,
    difficulty: "medium",
    problem_type: "objective",
  };
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function postGenerate(
  fetch: typeof globalThis.fetch,
  count = 1,
): Promise<WireSseEvent[]> {
  const response = await fetch(generateRequest(count));
  const text = await response.text();
  return parseSse(text);
}

function parseSse(text: string): WireSseEvent[] {
  return text
    .trim()
    .split(/\n\n/)
    .filter(Boolean)
    .map((chunk) => {
      const eventLine = chunk.split("\n").find((line) => line.startsWith("event: "));
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
      if (eventLine === undefined || dataLine === undefined) {
        throw new Error(`Invalid SSE chunk: ${chunk}`);
      }
      const eventName = eventLine.slice("event: ".length);
      const data = JSON.parse(dataLine.slice("data: ".length)) as unknown;
      return { event: eventName, data } as WireSseEvent;
    });
}

function fakeRag(refs: RagResult[]): RagClient {
  return { async search() { return refs; } };
}

function fakePrompts(): PromptLoader {
  return {
    async load(id) {
      return {
        metadata: {
          id,
          version: "0.1.0",
          model: "fake",
          temperature: 0,
          variables: [],
          owner: "test",
          updated: "2026-06-02",
        },
        rawBody: "",
        render() { return "{}"; },
      };
    },
  };
}

function fakeStrategies(): StrategyLoader {
  return { async load() { return strategy; } };
}

function fakeMathEngine(): MathEngineClient {
  return {
    async health() { return { status: "ok", engine: "sympy" }; },
    async solve() { return { solutions: ["2", "5"] }; },
    async verify(req) {
      const norm = (s: string) => s.replace(/\s+/g, "");
      return { equivalent: norm(req.expr1) === norm(req.expr2), diff: "0" };
    },
    async simplify(req) { return { simplified: req.expr.replace(/\s+/g, "") }; },
    async differentiate() { return { derivative: "0" }; },
    async limit() { return { limit: "0" }; },
  };
}

function fakeModel(): LanguageModel {
  return {
    specificationVersion: "v1",
    provider: "fake",
    modelId: "fake",
    defaultObjectGenerationMode: "json",
    async doGenerate() {
      return {
        text: JSON.stringify(intent),
        finishReason: "stop",
        usage: { promptTokens: 1, completionTokens: 1 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
    async doStream() {
      return {
        stream: new ReadableStream(),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}
