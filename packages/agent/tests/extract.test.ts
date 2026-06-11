import { describe, expect, it } from "vitest";

import type { ClassifierAgent, ExtractorAgent } from "../src/agents/index.js";
import { resolveClassification, type LlmClassification } from "../src/agents/classifier-agent.js";
import { createExtractRoute } from "../src/server/routes/extract.js";
import {
  CURRICULUM_TOPICS,
  GenerationKindSchema,
  generationKindForTopic,
  type Classification,
  type ExtractResponse,
  type Extraction,
} from "../src/schemas/index.js";

function extraction(over: Partial<Extraction> = {}): Extraction {
  return {
    question_text: "이차방정식 $x^2 - 5x + 6 = 0$의 두 근의 합을 구하시오.",
    choices: null,
    answer_text: null,
    figure_dependent: false,
    confidence: 0.9,
    ...over,
  };
}

function classification(over: Partial<Classification> = {}): Classification {
  return {
    school_level: "middle",
    grade: 3,
    topic_code: "9수02-09",
    topic_name: "이차방정식",
    problem_type: "short_answer",
    difficulty: "medium",
    confidence: 0.9,
    alternatives: [],
    ...over,
  };
}

const okExtractor: ExtractorAgent = { async extract() { return extraction(); } };
const okClassifier: ClassifierAgent = { async classify() { return classification(); } };

function jsonReq(body: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

describe("curriculum catalog", () => {
  it("has 43 topics with unique codes", () => {
    const codes = CURRICULUM_TOPICS.map((t) => t.code);
    expect(codes.length).toBe(43);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every catalog code maps to a valid generation kind", () => {
    for (const topic of CURRICULUM_TOPICS) {
      expect(GenerationKindSchema.options).toContain(generationKindForTopic(topic.code));
    }
  });
});

describe("resolveClassification", () => {
  const base: LlmClassification = {
    topic_code: "9수02-09",
    topic_name: "이차방정식",
    problem_type: "short_answer",
    difficulty: "medium",
    confidence: 0.9,
    alternatives: [],
  };

  it("snaps a valid code and derives level/grade/name from the catalog", () => {
    const r = resolveClassification(base);
    expect(r.topic_code).toBe("9수02-09");
    expect(r.school_level).toBe("middle");
    expect(r.grade).toBe(3);
    expect(r.topic_name).toBe("이차방정식");
    expect(r.confidence).toBe(0.9);
  });

  it("recovers via name when the code is wrong, lowering confidence", () => {
    const r = resolveClassification({ ...base, topic_code: "없는코드", topic_name: "이차방정식" });
    expect(r.topic_code).toBe("9수02-09");
    expect(r.confidence).toBeLessThanOrEqual(0.5);
  });

  it("returns an empty topic at very low confidence when nothing matches", () => {
    const r = resolveClassification({ ...base, topic_code: "10공수99-99", topic_name: "양자역학" });
    expect(r.topic_code).toBe("");
    expect(r.confidence).toBeLessThanOrEqual(0.3);
    expect(r.school_level).toBe("high");
  });

  it("keeps only valid alternatives and drops the matched topic", () => {
    const r = resolveClassification({
      ...base,
      alternatives: [
        { topic_code: "9수02-09", topic_name: "이차방정식" },
        { topic_code: "9수02-10", topic_name: "이차방정식의 활용" },
        { topic_code: "zzz", topic_name: "없음" },
      ],
    });
    expect(r.alternatives).toEqual([{ topic_code: "9수02-10", topic_name: "이차방정식의 활용" }]);
  });

  it("promotes the first valid alternative when the primary code and name are invalid", () => {
    const r = resolveClassification({
      ...base,
      topic_code: "없는코드",
      topic_name: "양자역학",
      alternatives: [{ topic_code: "9수02-10", topic_name: "이차방정식의 활용" }],
    });
    expect(r.topic_code).toBe("9수02-10");
    expect(r.school_level).toBe("middle");
    expect(r.grade).toBe(3);
    expect(r.alternatives).toEqual([]);
    expect(r.confidence).toBeLessThanOrEqual(0.4);
  });
});

describe("POST /api/extract", () => {
  it("returns 503 when models are not configured", async () => {
    const res = await createExtractRoute({}).request("/api/extract", jsonReq({ text: "x+1=0" }));
    expect(res.status).toBe(503);
  });

  it("reads pasted text into extraction + classification", async () => {
    const app = createExtractRoute({ extractor: okExtractor, classifier: okClassifier });
    const res = await app.request("/api/extract", jsonReq({ text: "이차방정식 x^2-5x+6=0" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ExtractResponse;
    expect(body.extraction.question_text).toContain("이차방정식");
    expect(body.classification.topic_code).toBe("9수02-09");
    expect(body.warnings).toEqual([]);
  });

  it("returns 400 when text is missing", async () => {
    const app = createExtractRoute({ extractor: okExtractor, classifier: okClassifier });
    const res = await app.request("/api/extract", jsonReq({}));
    expect(res.status).toBe(400);
  });

  it("warns when the extracted problem is figure-dependent", async () => {
    const figExtractor: ExtractorAgent = { async extract() { return extraction({ figure_dependent: true }); } };
    const app = createExtractRoute({ extractor: figExtractor, classifier: okClassifier });
    const res = await app.request("/api/extract", jsonReq({ text: "도형 문제" }));
    const body = (await res.json()) as ExtractResponse;
    expect(body.warnings.some((w) => w.includes("그림"))).toBe(true);
  });

  it("warns when classification confidence is low but still returns 200", async () => {
    const lowClassifier: ClassifierAgent = { async classify() { return classification({ confidence: 0.2 }); } };
    const app = createExtractRoute({ extractor: okExtractor, classifier: lowClassifier });
    const res = await app.request("/api/extract", jsonReq({ text: "x" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ExtractResponse;
    expect(body.warnings.some((w) => w.includes("단원"))).toBe(true);
  });

  it("opens manual confirm (200) when classification fails, not 502", async () => {
    const throwingClassifier: ClassifierAgent = {
      async classify() {
        throw new Error("classifier model down");
      },
    };
    const app = createExtractRoute({ extractor: okExtractor, classifier: throwingClassifier });
    const res = await app.request("/api/extract", jsonReq({ text: "x" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ExtractResponse;
    expect(body.extraction.question_text).toContain("이차방정식");
    expect(body.classification.topic_code).toBe("");
    expect(body.warnings.some((w) => w.includes("단원"))).toBe(true);
  });

  it("rejects an unsupported image type with 415", async () => {
    const app = createExtractRoute({ extractor: okExtractor, classifier: okClassifier });
    const form = new FormData();
    form.set("image", new File([new Uint8Array([1, 2, 3])], "p.gif", { type: "image/gif" }));
    const res = await app.request("/api/extract", { method: "POST", body: form });
    expect(res.status).toBe(415);
  });
});
