import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type {
  RagQuery,
  RagResult,
  SourceProblem,
} from "../src/schemas/index.js";
import {
  createSourceProblemsRoute,
  isFigureDependent,
} from "../src/server/routes/source-problems.js";
import type { RagClient } from "../src/tools/rag-client.js";

function makeProblem(overrides: {
  item_id: string;
  difficulty_norm: SourceProblem["difficulty_norm"];
  topic_code?: SourceProblem["topic_code"];
  school_level?: SourceProblem["school_level"];
  grade?: SourceProblem["grade"];
  question_text?: string;
}): SourceProblem {
  return {
    item_id: overrides.item_id,
    source_dataset: "111",
    split: "train",
    source_label_type: "problem_label",
    school_level: overrides.school_level ?? "middle",
    grade: overrides.grade ?? 3,
    semester: null,
    topic_code: overrides.topic_code ?? "9수02-09",
    topic_name: "이차방정식",
    achievement_standard: "이차방정식을 풀 수 있다.",
    question_text: overrides.question_text ?? `질문 ${overrides.item_id}`,
    answer_text: `정답 ${overrides.item_id}`,
    explanation_text: null,
    choice_blocks: null,
    problem_type_norm: "short_answer",
    difficulty_norm: overrides.difficulty_norm,
    question_image_relpath: null,
    answer_image_relpath: null,
    question_json_relpath: null,
    answer_json_relpath: null,
  };
}

function createMockRag(problems: SourceProblem[]): RagClient {
  return {
    async search(query: RagQuery): Promise<RagResult[]> {
      const filtered = problems.filter((problem) => {
        if (problem.school_level !== query.school_level) return false;
        if (query.grade !== null && problem.grade !== query.grade) return false;
        if (query.topic_code && problem.topic_code !== query.topic_code) {
          return false;
        }
        if (query.difficulty && problem.difficulty_norm !== query.difficulty) {
          return false;
        }
        return true;
      });

      return filtered.slice(0, query.k ?? 8).map((problem) => ({
        item_id: problem.item_id,
        similarity: 0.5,
        problem,
        match_reason: "structural",
      }));
    },
  };
}

describe("GET /api/source-problems", () => {
  const fixtures: SourceProblem[] = [
    makeProblem({ item_id: "mock-1", difficulty_norm: "easy" }),
    makeProblem({ item_id: "mock-2", difficulty_norm: "medium" }),
    makeProblem({ item_id: "mock-3", difficulty_norm: "hard" }),
    makeProblem({ item_id: "mock-4", difficulty_norm: "hard" }),
    makeProblem({
      item_id: "mock-other-topic",
      difficulty_norm: "medium",
      topic_code: "9수02-08",
    }),
    makeProblem({
      item_id: "mock-other-grade",
      difficulty_norm: "easy",
      grade: 2,
    }),
    makeProblem({
      item_id: "mock-figure",
      difficulty_norm: "medium",
      question_text: "다음 그림과 같이 정육면체를 잘라 낸 입체도형에서 면의 개수를 구하여라.",
    }),
  ];

  function buildApp(): Hono {
    const app = new Hono();
    app.route("/", createSourceProblemsRoute(createMockRag(fixtures)));
    return app;
  }

  it("returns source problems filtered by school_level + grade + topic_code", async () => {
    const app = buildApp();
    const topic = encodeURIComponent("9수02-09");
    const res = await app.request(
      `/api/source-problems?school_level=middle&grade=3&topic_code=${topic}`,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as SourceProblem[];
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(4);
    for (const item of body) {
      expect(item).toHaveProperty("item_id");
      expect(item).toHaveProperty("question_text");
      expect(item).toHaveProperty("answer_text");
      expect(item).toHaveProperty("difficulty_norm");
      expect(item.topic_code).toBe("9수02-09");
      expect(item.school_level).toBe("middle");
      expect(item.grade).toBe(3);
    }
  });

  it("returns 400 when school_level is missing", async () => {
    const app = buildApp();
    const res = await app.request("/api/source-problems?grade=3");
    expect(res.status).toBe(400);
  });

  it("narrows results when difficulty=hard", async () => {
    const app = buildApp();
    const topic = encodeURIComponent("9수02-09");
    const res = await app.request(
      `/api/source-problems?school_level=middle&grade=3&topic_code=${topic}&difficulty=hard`,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as SourceProblem[];
    expect(body).toHaveLength(2);
    expect(body.every((problem) => problem.difficulty_norm === "hard")).toBe(true);
  });

  it("returns [] for an unknown topic_code", async () => {
    const app = buildApp();
    const topic = encodeURIComponent("9수99-99");
    const res = await app.request(
      `/api/source-problems?school_level=middle&grade=3&topic_code=${topic}`,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as SourceProblem[];
    expect(body).toEqual([]);
  });

  it("excludes figure-dependent problems (statement references 그림)", async () => {
    const app = buildApp();
    const topic = encodeURIComponent("9수02-09");
    const res = await app.request(
      `/api/source-problems?school_level=middle&grade=3&topic_code=${topic}`,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as SourceProblem[];
    expect(body.some((p) => p.item_id === "mock-figure")).toBe(false);
    expect(body.every((p) => !p.question_text.includes("그림"))).toBe(true);
  });
});

describe("isFigureDependent", () => {
  it.each([
    ["다음 그림과 같이 정육면체를 잘라 낸 입체도형에서", true],
    ["다음 그래프는 x초 후 높이 y를 나타낸 것이다.", true],
    ["아래 그래프는 시간과 거리의 관계를 나타낸 것이다.", true],
    ["걸린 시간과 이동 거리를 그래프와 같이 나타내면", true],
    ["다음 표는 어느 반의 도수분포표이다.", true],
    ["다음 도형의 둘레의 길이를 구하여라.", true],
    ["성적을 정리하면 <table border> 와 같다.", true],
    ["모든 모서리의 합이 48이고 대각선이 3√6인 직육면체의 겉넓이를 구하시오.", false],
    ["이차함수 y=2x^2+3x-2의 그래프와 x축의 교점의 x좌표를 구하시오.", false],
    ["수직선 위에서 -7/5보다 큰 가장 작은 정수를 구하시오.", false],
    ["a^3+b^3을 보기와 같이 변형하여 값을 구하시오.", false],
    ["이차방정식 (2x+1)(x-4)=0을 풀어라.", false],
  ])("%s -> %s", (text, expected) => {
    expect(isFigureDependent(text)).toBe(expected);
  });
});
