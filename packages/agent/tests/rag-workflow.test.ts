import { describe, expect, it } from "vitest";

import type { RagClient } from "../src/tools/rag-client.js";
import type { MathEngineClient } from "../src/tools/math-engine-client.js";
import { ragSearch } from "../src/steps/rag-search.js";
import { runVerificationWorkflow } from "../src/workflows/verification-workflow.js";
import type { RagQuery, RagResult } from "../src/schemas/index.js";

describe("ragSearch", () => {
  it("falls back by relaxing type and difficulty filters when the primary query is empty", async () => {
    const calls: RagQuery[] = [];
    const rag: RagClient = {
      async search(query) {
        calls.push(query);
        if (calls.length === 1) {
          return [];
        }
        return [ragResult("111:train:fallback")];
      },
    };

    const out = await ragSearch(
      { rag },
      {
        request: {
          mode: "structural",
          school_level: "middle",
          grade: 2,
          topic_code: "9수04-04",
          topic_name: "도형의 닮음",
          count: 2,
          difficulty: "medium",
          problem_type: "objective",
        },
      },
    );

    expect(out.refs).toHaveLength(1);
    expect(out.fallback_used).toBe(true);
    expect(calls[0]).toMatchObject({
      difficulty: "medium",
      problem_type: "objective",
    });
    expect(calls[1]).toMatchObject({
      difficulty: undefined,
      problem_type: undefined,
    });
  });
});

describe("runVerificationWorkflow", () => {
  it("streams all six steps and emits verified fallback candidates", async () => {
    const rag: RagClient = {
      async search() {
        return [ragResult("111:train:similarity")];
      },
    };
    const mathEngine = fakeMathEngine();

    const events = [];
    const workflow = runVerificationWorkflow(
      { rag, mathEngine },
      {
        mode: "structural",
        school_level: "middle",
        grade: 2,
        topic_code: "9수04-04",
        topic_name: "도형의 닮음",
        count: 2,
        difficulty: "medium",
        problem_type: "objective",
      },
    );

    for await (const event of workflow) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      "step",
      "step",
      "step",
      "step",
      "step",
      "step",
      "step",
      "step",
      "step",
      "step",
      "step",
      "step",
      "result",
    ]);
    expect(events[1]).toMatchObject({
      type: "step",
      step: "rag",
      status: "done",
      data: {
        count: 1,
        refs: [
          {
            item_id: "111:train:similarity",
            topic_name: "도형의 닮음",
          },
        ],
      },
    });
    expect(events[3]).toMatchObject({
      type: "step",
      step: "intent",
      status: "done",
      data: {
        objective_code: "9수04-04",
        source_ref_count: 1,
      },
    });
    expect(events.at(-1)).toMatchObject({
      type: "result",
      candidates: [
        {
          verification: {
            overall: "verified",
          },
        },
        {
          verification: {
            overall: "verified",
          },
        },
      ],
    });
  });

  it("auto mode alternates structural and conceptual candidates", async () => {
    const rag: RagClient = {
      async search() {
        return [ragResult("111:train:similarity")];
      },
    };
    const events = [];
    const workflow = runVerificationWorkflow(
      { rag, mathEngine: fakeMathEngine() },
      {
        mode: "auto",
        school_level: "middle",
        grade: 2,
        topic_code: "9수04-04",
        topic_name: "도형의 닮음",
        count: 2,
        difficulty: "medium",
        problem_type: "objective",
      },
    );

    for await (const event of workflow) {
      events.push(event);
    }

    const result = events.at(-1);
    expect(result).toMatchObject({ type: "result" });
    if (result?.type !== "result") {
      throw new Error("expected result event");
    }
    expect(result.candidates.map((item) => item.problem.mode)).toEqual([
      "structural",
      "conceptual",
    ]);
  });
});

function fakeMathEngine(): MathEngineClient {
  return {
    async health() {
      return { status: "ok", engine: "sympy" };
    },
    async solve(req) {
      const match = req.equation.match(/x\s*\+\s*(\d+)\s*=\s*(\d+)/);
      if (match === null) {
        return { solutions: [] };
      }
      return { solutions: [String(Number(match[2]) - Number(match[1]))] };
    },
    async verify(req) {
      const equivalent = req.expr1.trim() === req.expr2.trim();
      return { equivalent, diff: equivalent ? "0" : `${req.expr1}-${req.expr2}` };
    },
    async simplify(req) {
      return { simplified: req.expr };
    },
    async differentiate() {
      return { derivative: "0" };
    },
    async limit() {
      return { limit: "0" };
    },
  };
}

function ragResult(itemId: string): RagResult {
  return {
    item_id: itemId,
    similarity: 0.75,
    match_reason: "hybrid",
    problem: {
      item_id: itemId,
      source_dataset: "111",
      split: "train",
      source_label_type: "problem_label",
      school_level: "middle",
      grade: 2,
      semester: null,
      topic_code: "9수04-04",
      topic_name: "도형의 닮음",
      achievement_standard:
        "도형의 닮음의 뜻과 닮은 도형의 성질을 이해하고, 닮음비를 구할 수 있다.",
      question_text: "다음 두 도형의 닮음비를 구하여라.",
      answer_text: "2:3",
      explanation_text: "대응변의 길이의 비를 비교한다.",
      choice_blocks: [],
      problem_type_norm: "objective",
      difficulty_norm: "medium",
      question_image_relpath: null,
      answer_image_relpath: null,
      question_json_relpath: null,
      answer_json_relpath: null,
    },
  };
}
