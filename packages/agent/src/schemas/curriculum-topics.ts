/**
 * 교육과정 단원 카탈로그 — 중1~중3 + 고등 공통수학 (총 43개).
 *
 * 첨부 문제 분류(classifier-agent)가 이 코드 집합 안에서만 단원을 고르고,
 * extract 라우트가 분류 결과를 유효한 코드로 스냅한다. FE `packages/web/app/app/new/topic/data.ts`
 * 와 동일한 집합이어야 한다 (코드↔이름↔학년). 동기화 테스트로 보장.
 *
 * generation-kind.schema.ts 의 TOPIC_KIND_BY_CODE 와 코드 집합이 일치한다.
 */

import { z } from "zod";

import { SchoolLevelSchema } from "./source-problem.schema.js";

export const CurriculumTopicSchema = z.object({
  school_level: SchoolLevelSchema,
  grade: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
});

export type CurriculumTopic = z.infer<typeof CurriculumTopicSchema>;

export const CURRICULUM_TOPICS: readonly CurriculumTopic[] = [
  /* 중1 */
  { school_level: "middle", grade: 1, code: "9수01-01", name: "소인수분해" },
  { school_level: "middle", grade: 1, code: "9수01-02", name: "정수와 유리수" },
  { school_level: "middle", grade: 1, code: "9수01-03", name: "유리수의 사칙연산" },
  { school_level: "middle", grade: 1, code: "9수02-01", name: "문자의 사용과 식의 값" },
  { school_level: "middle", grade: 1, code: "9수02-02", name: "일차식의 계산" },
  { school_level: "middle", grade: 1, code: "9수02-03", name: "일차방정식" },
  { school_level: "middle", grade: 1, code: "9수02-04", name: "일차방정식의 활용" },
  { school_level: "middle", grade: 1, code: "9수03-01", name: "함수의 개념" },
  { school_level: "middle", grade: 1, code: "9수04-01", name: "기본 도형과 작도" },
  { school_level: "middle", grade: 1, code: "9수05-01", name: "자료의 정리와 해석" },
  /* 중2 */
  { school_level: "middle", grade: 2, code: "9수01-04", name: "유리수와 순환소수" },
  { school_level: "middle", grade: 2, code: "9수02-05", name: "식의 계산" },
  { school_level: "middle", grade: 2, code: "9수02-06", name: "일차부등식" },
  { school_level: "middle", grade: 2, code: "9수02-07", name: "연립일차방정식" },
  { school_level: "middle", grade: 2, code: "9수03-02", name: "일차함수와 그래프" },
  { school_level: "middle", grade: 2, code: "9수03-03", name: "일차함수의 활용" },
  { school_level: "middle", grade: 2, code: "9수04-02", name: "삼각형의 성질" },
  { school_level: "middle", grade: 2, code: "9수04-03", name: "사각형의 성질" },
  { school_level: "middle", grade: 2, code: "9수04-04", name: "도형의 닮음" },
  { school_level: "middle", grade: 2, code: "9수05-02", name: "경우의 수와 확률" },
  /* 중3 */
  { school_level: "middle", grade: 3, code: "9수01-05", name: "제곱근과 실수" },
  { school_level: "middle", grade: 3, code: "9수01-06", name: "근호를 포함한 식의 계산" },
  { school_level: "middle", grade: 3, code: "9수02-08", name: "다항식의 곱셈과 인수분해" },
  { school_level: "middle", grade: 3, code: "9수02-09", name: "이차방정식" },
  { school_level: "middle", grade: 3, code: "9수02-10", name: "이차방정식의 활용" },
  { school_level: "middle", grade: 3, code: "9수03-04", name: "이차함수와 그래프" },
  { school_level: "middle", grade: 3, code: "9수04-05", name: "삼각비" },
  { school_level: "middle", grade: 3, code: "9수04-06", name: "원과 직선의 위치 관계" },
  { school_level: "middle", grade: 3, code: "9수04-07", name: "원주각" },
  { school_level: "middle", grade: 3, code: "9수05-03", name: "대푯값과 산포도" },
  /* 고등 공통수학 */
  { school_level: "high", grade: null, code: "10공수01-01", name: "다항식의 연산" },
  { school_level: "high", grade: null, code: "10공수01-02", name: "나머지정리" },
  { school_level: "high", grade: null, code: "10공수01-03", name: "인수분해" },
  { school_level: "high", grade: null, code: "10공수01-04", name: "복소수와 이차방정식" },
  { school_level: "high", grade: null, code: "10공수01-05", name: "이차방정식과 이차함수" },
  { school_level: "high", grade: null, code: "10공수02-01", name: "직선의 방정식" },
  { school_level: "high", grade: null, code: "10공수02-02", name: "원의 방정식" },
  { school_level: "high", grade: null, code: "10공수03-01", name: "집합" },
  { school_level: "high", grade: null, code: "10공수03-02", name: "명제" },
  { school_level: "high", grade: null, code: "10공수04-01", name: "함수" },
  { school_level: "high", grade: null, code: "10공수04-02", name: "유리함수와 무리함수" },
  { school_level: "high", grade: null, code: "10공수05-01", name: "경우의 수" },
  { school_level: "high", grade: null, code: "10공수05-02", name: "순열과 조합" },
];

export function gradeScopeLabel(topic: Pick<CurriculumTopic, "school_level" | "grade">): string {
  if (topic.school_level === "high") return "고등 공통수학";
  return topic.grade === null ? "중등" : `중${topic.grade}`;
}

export function findCurriculumTopic(code: string): CurriculumTopic | undefined {
  return CURRICULUM_TOPICS.find((topic) => topic.code === code);
}

/** 이름 기준 느슨한 매칭 — 정확 일치 우선, 없으면 부분 포함. 분류기가 코드를 틀렸을 때의 폴백. */
export function findCurriculumTopicByName(name: string): CurriculumTopic | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) return undefined;
  const exact = CURRICULUM_TOPICS.find((topic) => topic.name === trimmed);
  if (exact !== undefined) return exact;
  return CURRICULUM_TOPICS.find(
    (topic) => topic.name.includes(trimmed) || trimmed.includes(topic.name),
  );
}

export function curriculumTopicsForScope(
  schoolLevel: CurriculumTopic["school_level"],
  grade: CurriculumTopic["grade"],
): CurriculumTopic[] {
  return CURRICULUM_TOPICS.filter(
    (topic) => topic.school_level === schoolLevel && topic.grade === grade,
  );
}

/** 분류기 프롬프트에 넣을 카탈로그 문자열. 학년별로 묶어 `- <code> <name>` 라인으로 나열. */
export function formatCurriculumCatalog(): string {
  const groups: { label: string; items: CurriculumTopic[] }[] = [
    { label: "중1", items: curriculumTopicsForScope("middle", 1) },
    { label: "중2", items: curriculumTopicsForScope("middle", 2) },
    { label: "중3", items: curriculumTopicsForScope("middle", 3) },
    { label: "고등 공통수학", items: curriculumTopicsForScope("high", null) },
  ];
  return groups
    .map((group) => {
      const lines = group.items.map((topic) => `- ${topic.code} ${topic.name}`).join("\n");
      return `[${group.label}]\n${lines}`;
    })
    .join("\n\n");
}
