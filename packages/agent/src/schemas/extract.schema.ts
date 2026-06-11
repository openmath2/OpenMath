/**
 * Extract — POST /api/extract 의 응답 도메인 타입.
 *
 * 첨부 문제(텍스트 붙여넣기 또는 이미지)를 읽어 들여 (extraction) 교육과정
 * 단원을 자동 인식한 (classification) 결과. 사용자가 확인·수정한 뒤
 * source_problem_text 로 기존 생성 파이프라인(POST /api/generate)에 투입된다.
 *
 * - ExtractionSchema 는 extractor-agent 의 generateObject 출력 스키마로도 쓰인다.
 * - Classification 은 classifier-agent 가 카탈로그(curriculum-topics)로 스냅한 결과.
 */

import { z } from "zod";

import {
  DifficultySchema,
  ProblemTypeSchema,
  SchoolLevelSchema,
} from "./source-problem.schema.js";

export const ExtractionSchema = z.object({
  question_text: z
    .string()
    .min(1)
    .describe("읽어 들인 문제 본문. KaTeX 렌더 가능한 LaTeX 포함 plain text. 보기는 제외."),
  choices: z
    .array(z.string())
    .nullable()
    .default(null)
    .describe("객관식이면 보기 배열(예: ['① ...','② ...']). 객관식이 아니면 null."),
  answer_text: z
    .string()
    .nullable()
    .default(null)
    .describe("원본에 정답이 함께 보이면 그 정답, 없으면 null."),
  figure_dependent: z
    .boolean()
    .describe("그림·그래프·표가 있어야만 풀 수 있고 본문 텍스트만으로는 결정되지 않으면 true."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("읽어 들인 본문의 정확도 확신(0~1). 흐릿함·손글씨·수식 누락이면 낮춘다."),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export const ClassificationAlternativeSchema = z.object({
  topic_code: z.string(),
  topic_name: z.string(),
});

export type ClassificationAlternative = z.infer<typeof ClassificationAlternativeSchema>;

export const ClassificationSchema = z.object({
  school_level: SchoolLevelSchema,
  grade: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  topic_code: z.string(),
  topic_name: z.string(),
  problem_type: ProblemTypeSchema,
  difficulty: DifficultySchema,
  confidence: z.number().min(0).max(1),
  alternatives: z.array(ClassificationAlternativeSchema).default([]),
});

export type Classification = z.infer<typeof ClassificationSchema>;

export const ExtractResponseSchema = z.object({
  extraction: ExtractionSchema,
  classification: ClassificationSchema,
  /** 사용자에게 보여줄 평문 경고 (그림 의존, 단원 매칭 불확실 등). */
  warnings: z.array(z.string()).default([]),
});

export type ExtractResponse = z.infer<typeof ExtractResponseSchema>;
