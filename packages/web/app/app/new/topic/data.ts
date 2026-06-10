export type SchoolLevel = "middle" | "high";
export type Grade = 1 | 2 | 3;

export type Category =
  | "수와 연산"
  | "문자와 식"
  | "함수"
  | "기하"
  | "확률과 통계"
  | "집합과 명제";

export type Topic = {
  schoolLevel: SchoolLevel;
  grade: Grade | null;
  course: string;
  category: Category;
  code: string;
  name: string;
  achievement: string;
};

export const categories: readonly ("전체" | Category)[] = [
  "전체",
  "수와 연산",
  "문자와 식",
  "함수",
  "기하",
  "확률과 통계",
  "집합과 명제",
] as const;

export const topics: Topic[] = [
  /* ───── 중1 ───── */
  {
    schoolLevel: "middle",
    grade: 1,
    course: "중학교 수학",
    category: "수와 연산",
    code: "9수01-01",
    name: "소인수분해",
    achievement:
      "자연수를 소인수분해 하고, 이를 이용하여 약수와 배수를 구한다.",
  },
  {
    schoolLevel: "middle",
    grade: 1,
    course: "중학교 수학",
    category: "수와 연산",
    code: "9수01-02",
    name: "정수와 유리수",
    achievement: "양수와 음수, 정수와 유리수의 개념을 이해한다.",
  },
  {
    schoolLevel: "middle",
    grade: 1,
    course: "중학교 수학",
    category: "수와 연산",
    code: "9수01-03",
    name: "유리수의 사칙연산",
    achievement: "유리수의 사칙계산의 원리를 이해하고 계산할 수 있다.",
  },
  {
    schoolLevel: "middle",
    grade: 1,
    course: "중학교 수학",
    category: "문자와 식",
    code: "9수02-01",
    name: "문자의 사용과 식의 값",
    achievement: "문자를 사용하여 수량 관계를 식으로 나타낸다.",
  },
  {
    schoolLevel: "middle",
    grade: 1,
    course: "중학교 수학",
    category: "문자와 식",
    code: "9수02-02",
    name: "일차식의 계산",
    achievement: "일차식의 덧셈과 뺄셈의 원리를 이해하고 계산한다.",
  },
  {
    schoolLevel: "middle",
    grade: 1,
    course: "중학교 수학",
    category: "문자와 식",
    code: "9수02-03",
    name: "일차방정식",
    achievement: "등식의 성질을 이해하고 일차방정식의 해를 구한다.",
  },
  {
    schoolLevel: "middle",
    grade: 1,
    course: "중학교 수학",
    category: "문자와 식",
    code: "9수02-04",
    name: "일차방정식의 활용",
    achievement: "일차방정식을 활용하여 다양한 문제를 해결한다.",
  },
  {
    schoolLevel: "middle",
    grade: 1,
    course: "중학교 수학",
    category: "함수",
    code: "9수03-01",
    name: "함수의 개념",
    achievement: "함수의 개념을 이해하고 함숫값을 구한다.",
  },
  {
    schoolLevel: "middle",
    grade: 1,
    course: "중학교 수학",
    category: "기하",
    code: "9수04-01",
    name: "기본 도형과 작도",
    achievement: "점 · 선 · 면의 위치 관계를 이해하고 삼각형을 작도한다.",
  },
  {
    schoolLevel: "middle",
    grade: 1,
    course: "중학교 수학",
    category: "확률과 통계",
    code: "9수05-01",
    name: "자료의 정리와 해석",
    achievement: "줄기와 잎 그림 · 도수분포표 · 히스토그램으로 자료를 정리한다.",
  },

  /* ───── 중2 ───── */
  {
    schoolLevel: "middle",
    grade: 2,
    course: "중학교 수학",
    category: "수와 연산",
    code: "9수01-04",
    name: "유리수와 순환소수",
    achievement: "유리수가 유한소수 또는 순환소수로 표현됨을 이해한다.",
  },
  {
    schoolLevel: "middle",
    grade: 2,
    course: "중학교 수학",
    category: "문자와 식",
    code: "9수02-05",
    name: "식의 계산",
    achievement: "지수법칙과 다항식의 곱셈 · 나눗셈을 이해한다.",
  },
  {
    schoolLevel: "middle",
    grade: 2,
    course: "중학교 수학",
    category: "문자와 식",
    code: "9수02-06",
    name: "일차부등식",
    achievement: "부등식의 성질을 이해하고 일차부등식의 해를 구한다.",
  },
  {
    schoolLevel: "middle",
    grade: 2,
    course: "중학교 수학",
    category: "문자와 식",
    code: "9수02-07",
    name: "연립일차방정식",
    achievement: "미지수가 두 개인 연립일차방정식의 해를 구한다.",
  },
  {
    schoolLevel: "middle",
    grade: 2,
    course: "중학교 수학",
    category: "함수",
    code: "9수03-02",
    name: "일차함수와 그래프",
    achievement: "일차함수의 그래프의 성질과 식을 구한다.",
  },
  {
    schoolLevel: "middle",
    grade: 2,
    course: "중학교 수학",
    category: "함수",
    code: "9수03-03",
    name: "일차함수의 활용",
    achievement: "일차함수를 활용하여 실생활 문제를 해결한다.",
  },
  {
    schoolLevel: "middle",
    grade: 2,
    course: "중학교 수학",
    category: "기하",
    code: "9수04-02",
    name: "삼각형의 성질",
    achievement: "이등변삼각형의 성질과 삼각형의 외심 · 내심을 이해한다.",
  },
  {
    schoolLevel: "middle",
    grade: 2,
    course: "중학교 수학",
    category: "기하",
    code: "9수04-03",
    name: "사각형의 성질",
    achievement: "평행사변형 · 직사각형 · 마름모 · 정사각형의 성질을 이해한다.",
  },
  {
    schoolLevel: "middle",
    grade: 2,
    course: "중학교 수학",
    category: "기하",
    code: "9수04-04",
    name: "도형의 닮음",
    achievement: "도형의 닮음을 이해하고 닮음비를 활용한다.",
  },
  {
    schoolLevel: "middle",
    grade: 2,
    course: "중학교 수학",
    category: "확률과 통계",
    code: "9수05-02",
    name: "경우의 수와 확률",
    achievement: "경우의 수와 확률의 개념을 이해하고 구한다.",
  },

  /* ───── 중3 ───── */
  {
    schoolLevel: "middle",
    grade: 3,
    course: "중학교 수학",
    category: "수와 연산",
    code: "9수01-05",
    name: "제곱근과 실수",
    achievement: "제곱근의 뜻과 실수의 분류를 이해한다.",
  },
  {
    schoolLevel: "middle",
    grade: 3,
    course: "중학교 수학",
    category: "수와 연산",
    code: "9수01-06",
    name: "근호를 포함한 식의 계산",
    achievement: "근호를 포함한 식의 사칙계산을 한다.",
  },
  {
    schoolLevel: "middle",
    grade: 3,
    course: "중학교 수학",
    category: "문자와 식",
    code: "9수02-08",
    name: "다항식의 곱셈과 인수분해",
    achievement: "다항식의 곱셈공식과 인수분해 공식을 이해한다.",
  },
  {
    schoolLevel: "middle",
    grade: 3,
    course: "중학교 수학",
    category: "문자와 식",
    code: "9수02-09",
    name: "이차방정식",
    achievement: "이차방정식의 해를 인수분해 · 근의 공식으로 구한다.",
  },
  {
    schoolLevel: "middle",
    grade: 3,
    course: "중학교 수학",
    category: "문자와 식",
    code: "9수02-10",
    name: "이차방정식의 활용",
    achievement: "이차방정식을 활용하여 다양한 문제를 해결한다.",
  },
  {
    schoolLevel: "middle",
    grade: 3,
    course: "중학교 수학",
    category: "함수",
    code: "9수03-04",
    name: "이차함수와 그래프",
    achievement: "이차함수의 그래프의 성질과 식을 구한다.",
  },
  {
    schoolLevel: "middle",
    grade: 3,
    course: "중학교 수학",
    category: "기하",
    code: "9수04-05",
    name: "삼각비",
    achievement: "직각삼각형에서 삼각비의 값을 구하고 활용한다.",
  },
  {
    schoolLevel: "middle",
    grade: 3,
    course: "중학교 수학",
    category: "기하",
    code: "9수04-06",
    name: "원과 직선의 위치 관계",
    achievement: "원과 직선의 위치 관계를 이해하고 접선의 성질을 활용한다.",
  },
  {
    schoolLevel: "middle",
    grade: 3,
    course: "중학교 수학",
    category: "기하",
    code: "9수04-07",
    name: "원주각",
    achievement: "원주각의 성질을 이해하고 활용한다.",
  },
  {
    schoolLevel: "middle",
    grade: 3,
    course: "중학교 수학",
    category: "확률과 통계",
    code: "9수05-03",
    name: "대푯값과 산포도",
    achievement: "평균 · 중앙값 · 최빈값 · 분산 · 표준편차를 이해한다.",
  },

  /* ───── 고등 공통수학 ───── */
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "문자와 식",
    code: "10공수01-01",
    name: "다항식의 연산",
    achievement: "다항식의 덧셈 · 뺄셈 · 곱셈을 계산하고 식을 변형한다.",
  },
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "문자와 식",
    code: "10공수01-02",
    name: "나머지정리",
    achievement: "항등식과 나머지정리를 이용하여 다항식의 값을 구한다.",
  },
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "문자와 식",
    code: "10공수01-03",
    name: "인수분해",
    achievement: "여러 가지 인수분해 공식을 이용하여 다항식을 인수분해한다.",
  },
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "문자와 식",
    code: "10공수01-04",
    name: "복소수와 이차방정식",
    achievement: "복소수의 뜻과 성질을 이해하고 이차방정식의 해를 해석한다.",
  },
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "문자와 식",
    code: "10공수01-05",
    name: "이차방정식과 이차함수",
    achievement: "이차방정식과 이차함수의 관계를 그래프와 식으로 해석한다.",
  },
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "기하",
    code: "10공수02-01",
    name: "직선의 방정식",
    achievement: "좌표평면에서 직선의 방정식을 구하고 위치 관계를 해석한다.",
  },
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "기하",
    code: "10공수02-02",
    name: "원의 방정식",
    achievement: "원의 방정식과 접선의 방정식을 구하고 도형 조건을 해석한다.",
  },
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "집합과 명제",
    code: "10공수03-01",
    name: "집합",
    achievement: "집합의 연산과 포함 관계를 이용하여 원소의 개수를 구한다.",
  },
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "집합과 명제",
    code: "10공수03-02",
    name: "명제",
    achievement: "명제의 참거짓과 충분조건 · 필요조건 · 필요충분조건을 판단한다.",
  },
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "함수",
    code: "10공수04-01",
    name: "함수",
    achievement: "함수의 뜻과 그래프를 이해하고 합성함수와 역함수를 다룬다.",
  },
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "함수",
    code: "10공수04-02",
    name: "유리함수와 무리함수",
    achievement: "유리함수와 무리함수의 그래프와 성질을 해석한다.",
  },
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "확률과 통계",
    code: "10공수05-01",
    name: "경우의 수",
    achievement: "합의 법칙과 곱의 법칙을 이용하여 경우의 수를 구한다.",
  },
  {
    schoolLevel: "high",
    grade: null,
    course: "공통수학",
    category: "확률과 통계",
    code: "10공수05-02",
    name: "순열과 조합",
    achievement: "순열과 조합의 뜻을 이해하고 경우의 수를 계산한다.",
  },
];

export function parseGrade(
  raw: string | string[] | undefined,
): Grade | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s === "1") return 1;
  if (s === "2") return 2;
  if (s === "3") return 3;
  return null;
}

export function parseSchoolLevel(raw: string | string[] | undefined): SchoolLevel {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return s === "high" ? "high" : "middle";
}

export function gradeLabel(g: Grade | null, schoolLevel: SchoolLevel = "middle"): string {
  if (schoolLevel === "high") return g === null ? "고등 공통수학" : `고${g}`;
  return g === null ? "중등" : `중${g}`;
}

export function topicScopeLabel(topic: Topic): string {
  return `${gradeLabel(topic.grade, topic.schoolLevel)} · ${topic.course}`;
}

export function pickFirst(
  raw: string | string[] | undefined,
): string | null {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

export function findTopic(code: string | null): Topic | null {
  if (code === null) return null;
  return topics.find((t) => t.code === code) ?? null;
}

export function topicsForScope(schoolLevel: SchoolLevel, grade: Grade | null): Topic[] {
  return topics.filter((topic) => topic.schoolLevel === schoolLevel && topic.grade === grade);
}
