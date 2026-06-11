import { describe, expect, it } from "vitest";

import {
  GenerateRequestSchema,
  type GeneratedProblem,
  type ProgressEvent,
  type Verification,
} from "../src/schemas/index.js";
import { pipeProgressToSse } from "../src/server/sse/progress-stream.js";
import { toWireSseEvent } from "../src/server/sse/wire-adapter.js";
import { verifyWithSympy } from "../src/steps/index.js";
import {
  createFsPromptLoader,
  createFsStrategyLoader,
  createInMemoryRagClient,
  createMathEngineClient,
  resolveLanguageModel,
} from "../src/tools/index.js";
import type { MathEngineClient } from "../src/tools/index.js";

describe("FE-compatible generate contract", () => {
  it("accepts the current web hook request body", () => {
    const parsed = GenerateRequestSchema.parse({
      grade: 3,
      topic: "9수02-09",
      mode: "structural",
      dims: ["이차식을 인수분해하여 해를 구한다"],
    });

    expect(parsed.topic).toBe("9수02-09");
    expect(parsed.topic_code).toBeUndefined();
    expect(parsed.count).toBe(5);
    expect(parsed.difficulty).toBe("medium");
  });

  it("accepts high-school common-math requests from the web hook", () => {
    const parsed = GenerateRequestSchema.parse({
      school_level: "high",
      grade: null,
      topic: "10공수01-01",
      topic_name: "다항식의 연산",
      mode: "structural",
      dims: ["다항식의 표준 풀이 절차를 단계별로 수행"],
    });

    expect(parsed.school_level).toBe("high");
    expect(parsed.grade).toBeNull();
    expect(parsed.topic).toBe("10공수01-01");
  });

  it("rejects middle-school requests without grade", () => {
    expect(() =>
      GenerateRequestSchema.parse({ grade: null, topic: "9수02-09", mode: "structural" }),
    ).toThrow(/Middle school requests require grade/);
  });

  it("rejects requests without topic or topic_code", () => {
    expect(() =>
      GenerateRequestSchema.parse({ grade: 3, mode: "structural" }),
    ).toThrow(/Either topic or topic_code is required/);
  });
});

describe("SSE wire adapter", () => {
  it("maps domain step events to frontend step events", () => {
    const wire = toWireSseEvent({
      type: "step",
      step: "sympy_verify",
      status: "start",
      timestamp: "2026-05-21T00:00:00.000Z",
      data: "검증 시작",
    });

    expect(wire).toEqual({
      event: "step",
      data: {
        index: 4,
        name: "산술 검증 (SymPy)",
        status: "started",
        summary: null,
      },
    });
  });

  it("includes failed gate details in step summaries", () => {
    const wire = toWireSseEvent({
      type: "step",
      step: "objective_map",
      status: "done",
      timestamp: "2026-05-21T00:00:00.000Z",
      data: {
        gate: {
          step: "objective_map",
          status: "failed",
          duration_ms: 1,
          failure_detail: {
            code: "intent_topic_mismatch",
            message: "Intent does not match requested topic",
          },
        },
      },
    });

    expect(wire).toEqual({
      event: "step",
      data: {
        index: 6,
        name: "학습 목표 점검",
        status: "failed",
        summary: "intent_topic_mismatch: Intent does not match requested topic",
      },
    });
  });

  it("maps retry events to attempt events and sanitizes internal errors", () => {
    const retry = toWireSseEvent({
      type: "retry",
      attempt: 2,
      max_attempts: 3,
      reason: "SymPy 검산 불일치: 기대답 2, 엔진 결과 3 — 계수를 다시 검산하라",
      timestamp: "2026-05-21T00:00:00.000Z",
    });
    expect(retry).toEqual({
      event: "attempt",
      data: {
        attempt: 2,
        max_attempts: 3,
        reason: "SymPy 검산 불일치: 기대답 2, 엔진 결과 3 — 계수를 다시 검산하라",
      },
    });

    const error = toWireSseEvent({
      type: "error",
      stage: "orchestrator",
      code: "upstream_secret_error",
      message: "OPENAI_API_KEY leaked /tmp/internal",
      recoverable: false,
      timestamp: "2026-05-21T00:00:00.000Z",
    });
    expect(error).toEqual({
      event: "error",
      data: {
        stage: "orchestrator",
        message: "검증 파이프라인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      },
    });
  });

  it("maps preview events and unverified gates onto the wire", () => {
    const preview = toWireSseEvent({
      type: "preview",
      latex: "x**2 - 5*x + 6 = 0",
      timestamp: "2026-05-21T00:00:00.000Z",
    });
    expect(preview).toEqual({
      event: "preview",
      data: { latex: "x**2 - 5*x + 6 = 0" },
    });

    const unverified = toWireSseEvent({
      type: "step",
      step: "sympy_verify",
      status: "done",
      timestamp: "2026-05-21T00:00:00.000Z",
      data: {
        gate: {
          step: "sympy_verify",
          status: "unverified",
          duration_ms: 42,
          evidence: { engine: "sympy", verification_kind: "geometry" },
          failure_detail: {
            code: "sympy_unverified",
            message: "No deterministic SymPy verifier for geometry",
          },
        },
      },
    });
    expect(unverified.event).toBe("step");
    if (unverified.event !== "step") throw new Error("expected step event");
    expect(unverified.data.status).toBe("unverified");
    expect(unverified.data.summary).toContain("기호 검증 불가");
  });

  it("narrates successful gates in step summaries", () => {
    const wire = toWireSseEvent({
      type: "step",
      step: "generate",
      status: "done",
      timestamp: "2026-05-21T00:00:00.000Z",
      data: {
        gate: {
          step: "generate",
          status: "passed",
          duration_ms: 12_300,
          evidence: {
            candidate_id: "00000000-0000-0000-0000-000000000001",
            model: "gpt-5.5(xhigh)",
            refined_by: ["constraint-critic", "refiner", "constraint-critic"],
            critic_hints_total: 2,
          },
        },
      },
    });
    expect(wire.event).toBe("step");
    if (wire.event !== "step") throw new Error("expected step event");
    expect(wire.data.status).toBe("completed");
    expect(wire.data.summary).toBe(
      "후보 생성 (gpt-5.5(xhigh)) · Critic 2라운드 · 수정 1회 · 지적 2건 반영 · 12.3초",
    );
  });

  it("flattens domain result events for the frontend", () => {
    const problem: GeneratedProblem = {
      candidate_id: "00000000-0000-0000-0000-000000000001",
      mode: "structural",
      generation_kind: "equation",
      question_text: "x**2 - 5*x + 6 = 0",
      expected_answer: "2, 3",
      techniques_used: ["factorization"],
      proposed_solution_trace: "(x - 2)(x - 3) = 0",
      source_refs: ["seed-9수02-09-001"],
      inferred_intent: {
        objective_code: "9수02-09",
        objective_description: "이차방정식을 풀 수 있다",
        evaluation_dimensions: [
          {
            id: "A",
            description: "이차식을 인수분해하여 해를 구한다",
            must_preserve: true,
          },
        ],
        required_techniques: ["factorization"],
        forbidden_techniques: [],
        surface_constraints: { difficulty: "easy", problem_type: "short_answer" },
      },
      generation_metadata: {
        model: "seed",
        temperature: 0,
        prompt_id: "seed",
        prompt_version: "0.0.0",
        attempt: 0,
        generated_at: "2026-05-21T00:00:00.000Z",
      },
    };
    const verification: Verification = {
      candidate_id: problem.candidate_id,
      overall: "verified",
      gates: ["rag", "intent", "generate", "sympy_verify", "re_solve", "objective_map"].map(
        (step) => ({ step, status: "passed" as const, duration_ms: 1 }),
      ),
      attempt_count: 1,
    };
    const event: ProgressEvent = {
      type: "result",
      candidates: [{ problem, verification }],
      timestamp: "2026-05-21T00:00:00.000Z",
    };

    const wire = toWireSseEvent(event);

    expect(wire.event).toBe("result");
    if (wire.event !== "result") throw new Error("expected result event");
    expect(wire.data[0]?.id).toBe(problem.candidate_id);
    expect(wire.data[0]?.verification_status).toBe("pass");
    expect(wire.data[0]?.source_refs).toEqual(["seed-9수02-09-001"]);
    expect(wire.data[0]?.explanation_latex).toBe("(x - 2)(x - 3) = 0");
    expect(wire.data[0]?.preserved_dimensions).toEqual([
      "이차식을 인수분해하여 해를 구한다",
    ]);
  });

  it("pipes domain events into Hono SSE wire messages", async () => {
    const written: Array<{ event?: string; data: string | Promise<string> }> = [];
    const stream = {
      async writeSSE(message: { event?: string; data: string | Promise<string> }) {
        written.push(message);
      },
    };

    async function* events(): AsyncGenerator<ProgressEvent, void, void> {
      yield {
        type: "step",
        step: "rag",
        status: "done",
        timestamp: "2026-05-21T00:00:00.000Z",
      };
    }

    await pipeProgressToSse(
      stream as Parameters<typeof pipeProgressToSse>[0],
      events(),
    );

    expect(written).toEqual([
      {
        event: "step",
        data: JSON.stringify({
          index: 1,
          name: "비슷한 문제 찾기",
          status: "completed",
          summary: null,
        }),
      },
    ]);
  });

  it("turns pre-yield workflow errors into frontend-visible SSE errors", async () => {
    const written: Array<{ event?: string; data: string | Promise<string> }> = [];
    const stream = {
      async writeSSE(message: { event?: string; data: string | Promise<string> }) {
        written.push(message);
      },
    };

    async function* events(): AsyncGenerator<ProgressEvent, void, void> {
      throw new Error("Verification workflow requires intentModel");
    }

    await pipeProgressToSse(
      stream as Parameters<typeof pipeProgressToSse>[0],
      events(),
    );

    expect(written).toEqual([
      {
        event: "error",
        data: JSON.stringify({
          stage: "orchestrator",
          message: "검증 파이프라인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        }),
      },
    ]);
  });
});

describe("filesystem loaders", () => {
  it("loads and renders markdown prompts", async () => {
    const loader = createFsPromptLoader({ promptsDir: "prompts" });
    const prompt = await loader.load("intent-extraction");
    const rendered = prompt.render({
      request: {
        school_level: "middle",
        grade: 3,
        topic_name: "이차방정식",
        mode: "structural",
      },
      refs: [],
      strategy: "",
    });

    expect(prompt.metadata.id).toBe("intent-extraction");
    expect(rendered).toContain("2022 개정");
  });

  it("rejects prompt and strategy traversal attempts", async () => {
    const prompts = createFsPromptLoader({ promptsDir: "prompts" });
    await expect(prompts.load("../intent-extraction")).rejects.toThrow(/Invalid prompt id/);

    const strategies = createFsStrategyLoader({
      strategiesDir: "data/achievement-standards",
    });
    await expect(strategies.load("../9수02-09")).rejects.toThrow(/Invalid strategy code/);
  });

  it("loads seed strategies and searches the seed corpus", async () => {
    const strategies = createFsStrategyLoader({
      strategiesDir: "data/achievement-standards",
    });
    const strategy = await strategies.load("9수02-09");
    expect(strategy?.code).toBe("9수02-09");

    const rag = createInMemoryRagClient({
      jsonlPath: "data/corpus/math-sample-unified-v1.jsonl",
    });
    const refs = await rag.search({
      school_level: "middle",
      grade: 3,
      topic_code: "9수02-09",
      difficulty: "easy",
      problem_type: "short_answer",
      k: 5,
    });

    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0]?.problem.topic_code).toBe("9수02-09");
  });
});

describe("network client guardrails", () => {
  it("blocks metadata-service math-engine base URLs", () => {
    expect(() =>
      createMathEngineClient({ baseUrl: "http://169.254.169.254/latest" }),
    ).toThrow(/blocked/);
  });

  it("blocks metadata-service LLM base URLs", () => {
    expect(() =>
      resolveLanguageModel({
        kind: "openai-compatible",
        modelId: "gpt-4o",
        baseUrl: "http://169.254.169.254/v1",
      }),
    ).toThrow(/blocked/);
  });
});

describe("SymPy verification fail-closed behavior", () => {
  const candidate: GeneratedProblem = {
    candidate_id: "00000000-0000-0000-0000-000000000004",
    mode: "structural",
    generation_kind: "equation",
    question_text: "x**2 - 5*x + 6 = 0",
    expected_answer: "2, 3",
    techniques_used: ["factorization"],
    proposed_solution_trace: "internal trace",
    source_refs: ["seed-9수02-09-001"],
    inferred_intent: {
      objective_code: "9수02-09",
      objective_description: "이차방정식을 풀 수 있다",
      evaluation_dimensions: [
        { id: "A", description: "인수분해", must_preserve: true },
      ],
      required_techniques: ["factorization"],
      forbidden_techniques: [],
      surface_constraints: { difficulty: "easy", problem_type: "short_answer" },
    },
    generation_metadata: {
      model: "seed",
      temperature: 0,
      prompt_id: "seed",
      prompt_version: "0.0.0",
      attempt: 0,
      generated_at: "2026-05-21T00:00:00.000Z",
    },
  };

  function fakeMathEngine(solutions: string[]): MathEngineClient {
    return {
      async health() {
        return { status: "ok", engine: "sympy" };
      },
      async solve() {
        return { solutions };
      },
      async verify() {
        return { equivalent: true, diff: "0" };
      },
      async simplify(req) {
        return { simplified: req.expr.replace(/\s+/g, "") };
      },
      async differentiate() {
        return { derivative: "0" };
      },
      async limit() {
        return { limit: "0" };
      },
    };
  }

  it("passes exact canonical solution set matches", async () => {
    const result = await verifyWithSympy(
      { mathEngine: fakeMathEngine(["3", "2"]) },
      { candidate },
    );
    expect(result.gate.status).toBe("passed");
  });

  it("marks expression candidates unverified instead of syntax-only passed", async () => {
    const expressionCandidate: GeneratedProblem = {
      ...candidate,
      candidate_id: "00000000-0000-0000-0000-000000000005",
      generation_kind: "expression",
      question_text: "다항식 (x + 3)(x - 5)를 전개하시오.",
      expected_answer: "x**2 - 2*x - 15",
    };

    const result = await verifyWithSympy(
      { mathEngine: fakeMathEngine([]) },
      { candidate: expressionCandidate },
    );

    expect(result.gate.status).toBe("unverified");
    expect(result.gate.evidence).toMatchObject({
      verification_kind: "expression",
    });
  });

  it("marks choice-label equation candidates unverified when choices are not decidable", async () => {
    const choiceCandidate: GeneratedProblem = {
      ...candidate,
      question_text:
        "다음 중 이차방정식의 꼴로 정리할 수 없는 것은? ① x^2=1 ② x^2+x=0 ③ 2x^2=3 ④ x^2+1=x^2+2",
      expected_answer: "④",
    };
    const mathEngine: MathEngineClient = {
      ...fakeMathEngine([]),
      solve: async () => {
        throw new Error("solve should not be called");
      },
    };

    const result = await verifyWithSympy(
      { mathEngine },
      { candidate: choiceCandidate },
    );

    expect(result.gate.status).toBe("unverified");
  });

  it("marks empty solution sets unverified because SymPy returned no decidable result", async () => {
    const result = await verifyWithSympy(
      { mathEngine: fakeMathEngine([]) },
      { candidate },
    );
    expect(result.gate.status).toBe("unverified");
  });

  it("fails partial solution matches", async () => {
    const result = await verifyWithSympy(
      { mathEngine: fakeMathEngine(["2"]) },
      { candidate },
    );
    expect(result.gate.status).toBe("failed");
  });
});
