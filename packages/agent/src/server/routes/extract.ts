/**
 * POST /api/extract — 첨부 문제 읽기 + 단원 자동 인식.
 *
 * 입력: multipart/form-data(`image` 파일) 또는 application/json(`{ text }`).
 * 처리: extractor-agent(이미지=비전, 텍스트=정규화) → classifier-agent(단원 스냅).
 * 출력: ExtractResponse(extraction + classification + warnings).
 *
 * 모델 미설정 시 503. 추출/분류 실패는 502 + 평문 메시지(사용자에게 그대로 노출 가능).
 * 생성 파이프라인(POST /api/generate)은 건드리지 않는다 — 확인 화면을 거쳐 합류.
 */

import { Hono } from "hono";

import type { ClassifierAgent, ExtractorAgent } from "../../agents/index.js";
import {
  ExtractResponseSchema,
  type Classification,
  type Extraction,
  type ExtractResponse,
} from "../../schemas/index.js";
import { isFigureDependent } from "./source-problems.js";

export interface ExtractRouteDeps {
  extractor?: ExtractorAgent;
  classifier?: ClassifierAgent;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_TEXT_LENGTH = 8000;
const LOW_CONFIDENCE = 0.5;

export function createExtractRoute(deps: ExtractRouteDeps): Hono {
  const app = new Hono();

  app.post("/api/extract", async (c) => {
    const { extractor, classifier } = deps;
    if (extractor === undefined || classifier === undefined) {
      return c.json(
        { error: "extraction_unavailable", message: "문제 읽기 기능을 사용할 수 없습니다 (모델 미설정)." },
        503,
      );
    }

    let extraction: Extraction;
    try {
      const contentType = c.req.header("content-type") ?? "";
      if (contentType.includes("multipart/form-data")) {
        const file = (await c.req.parseBody())["image"];
        if (!(file instanceof File)) {
          return c.json({ error: "bad_request", message: "이미지 파일이 필요합니다." }, 400);
        }
        const mediaType = file.type.toLowerCase();
        if (!ALLOWED_IMAGE_TYPES.has(mediaType)) {
          return c.json({ error: "unsupported_media_type", message: "PNG · JPG · WEBP 이미지만 올릴 수 있어요." }, 415);
        }
        const buffer = await file.arrayBuffer();
        if (buffer.byteLength === 0) {
          return c.json({ error: "bad_request", message: "빈 파일입니다." }, 400);
        }
        if (buffer.byteLength > MAX_IMAGE_BYTES) {
          return c.json({ error: "payload_too_large", message: "이미지는 10MB 이하만 올릴 수 있어요." }, 413);
        }
        extraction = await extractor.extract({
          kind: "image",
          bytes: new Uint8Array(buffer),
          mediaType: mediaType === "image/jpg" ? "image/jpeg" : mediaType,
        });
      } else {
        const json: unknown = await c.req.json().catch(() => null);
        const text =
          json !== null && typeof json === "object"
            ? (json as Record<string, unknown>).text
            : undefined;
        if (typeof text !== "string" || text.trim().length === 0) {
          return c.json({ error: "bad_request", message: "문제 텍스트가 필요합니다." }, 400);
        }
        if (text.length > MAX_TEXT_LENGTH) {
          return c.json({ error: "payload_too_large", message: "문제 텍스트가 너무 깁니다." }, 413);
        }
        extraction = await extractor.extract({ kind: "text", text });
      }
    } catch (err) {
      console.error("[extract] extraction failed:", err instanceof Error ? err.message : err);
      return c.json(
        { error: "extraction_failed", message: "문제를 읽지 못했어요. 다른 사진이나 텍스트로 다시 시도해 주세요." },
        502,
      );
    }

    let classification: Classification;
    try {
      classification = await classifier.classify({ extraction });
    } catch (err) {
      // 분류 실패는 치명적이지 않다 — 추출은 성공했으니 단원을 비운 채 200 으로
      // 확인 화면을 열어 사용자가 학년 · 단원을 직접 고르게 한다 (수동 폴백).
      console.error("[extract] classification failed:", err instanceof Error ? err.message : err);
      classification = manualPickClassification(extraction);
    }

    const response: ExtractResponse = ExtractResponseSchema.parse({
      extraction,
      classification,
      warnings: buildWarnings(extraction, classification),
    });
    return c.json(response);
  });

  return app;
}

function buildWarnings(extraction: Extraction, classification: Classification): string[] {
  const warnings: string[] = [];
  if (extraction.figure_dependent || isFigureDependent(extraction.question_text)) {
    warnings.push("그림 · 그래프가 필요한 문제 같아요. 텍스트만으로는 변형이 정확하지 않을 수 있어요.");
  }
  if (extraction.confidence < LOW_CONFIDENCE) {
    warnings.push("문제를 또렷하게 읽지 못했어요. 아래 본문을 확인하고 고쳐 주세요.");
  }
  if (classification.topic_code === "" || classification.confidence < LOW_CONFIDENCE) {
    warnings.push("학년 · 단원 자동 인식이 확실하지 않아요. 맞는지 확인해 주세요.");
  }
  return warnings;
}

/** 분류기가 실패했을 때의 빈 분류 — 단원을 비워 확인 화면에서 수동 선택을 유도한다. */
function manualPickClassification(extraction: Extraction): Classification {
  const objective = extraction.choices !== null && extraction.choices.length > 0;
  return {
    school_level: "middle",
    grade: null,
    topic_code: "",
    topic_name: "",
    problem_type: objective ? "objective" : "short_answer",
    difficulty: "medium",
    confidence: 0,
    alternatives: [],
  };
}
