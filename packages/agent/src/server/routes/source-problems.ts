/**
 * GET /api/source-problems — read-only corpus lookup.
 *
 * Reuses the in-memory RagClient (D-7) without LLM / generation. The web S3
 * problem picker calls this to browse SourceProblem rows by school/grade/topic.
 *
 * Figure-dependent rows are dropped: the corpus image path is a non-servable
 * AI-Hub scan, so a statement that points at a figure/graph/table is unusable
 * as text-only. See isFigureDependent for why there is no clean corpus flag.
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  DifficultySchema,
  SchoolLevelSchema,
} from "../../schemas/source-problem.schema.js";
import type { RagClient } from "../../tools/rag-client.js";

// Big k = scan whole topic (≥ largest ~1.8k rows). search() already sorts the full
// match set so this only widens the final slice; lets figure filtering fill `limit`
// on figure-heavy topics instead of returning an all-figure first-50.
const FIGURE_FILTER_POOL = 2000;

// No reliable corpus flag for "needs a figure": media.image is on 100% of rows, and
// the VISUAL taxonomy tag also marks self-contained solids ("직육면체의 겉넓이"). So match
// only explicit references — "그림", a shown graph/도형/표 via deictic phrases, or embedded
// <table>. Bare "그래프"/"도형"/"표"/"좌표" stay (e.g. "y=x²의 그래프의 꼭짓점" is self-contained).
const FIGURE_REFERENCE =
  /그림|그래프와\s*같|(?:다음|아래|위)\s*그래프|(?:다음|아래)\s*도형|(?:다음|아래|위)의?\s*표(?:는|를|에|\s)|<table/i;

export function isFigureDependent(questionText: string): boolean {
  return FIGURE_REFERENCE.test(questionText);
}

const GradeQueryParamSchema = z.preprocess(
  (value) => {
    if (value === "common" || value === "null" || value === "") return null;
    if (value === "1" || value === 1) return 1;
    if (value === "2" || value === 2) return 2;
    if (value === "3" || value === 3) return 3;
    return value;
  },
  z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
);

const SourceProblemsQuerySchema = z.object({
  school_level: SchoolLevelSchema,
  grade: GradeQueryParamSchema,
  topic_code: z.string().min(1).optional(),
  difficulty: DifficultySchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export function createSourceProblemsRoute(rag: RagClient): Hono {
  const app = new Hono();

  app.get(
    "/api/source-problems",
    zValidator("query", SourceProblemsQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const results = await rag.search({
        school_level: q.school_level,
        grade: q.grade ?? null,
        topic_code: q.topic_code,
        difficulty: q.difficulty,
        k: FIGURE_FILTER_POOL,
      });
      const problems = results
        .map((r) => r.problem)
        .filter((p) => !isFigureDependent(p.question_text))
        .slice(0, q.limit);
      return c.json(problems);
    },
  );

  return app;
}
