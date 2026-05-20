export type Grade = 1 | 2 | 3;

export type Category =
  | "수와 연산"
  | "문자와 식"
  | "함수"
  | "기하"
  | "확률과 통계";

export type Topic = {
  grade: Grade;
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
] as const;

export const topics: Topic[] = [
  /* ───── 중1 ───── */
  {
    grade: 1,
    category: "수와 연산",
    code: "9수01-01",
    name: "소인수분해",
    achievement:
      "자연수를 소인수분해 하고, 이를 이용하여 약수와 배수를 구한다.",
  },
  {
    grade: 1,
    category: "수와 연산",
    code: "9수01-02",
    name: "정수와 유리수",
    achievement: "양수와 음수, 정수와 유리수의 개념을 이해한다.",
  },
  {
    grade: 1,
    category: "수와 연산",
    code: "9수01-03",
    name: "유리수의 사칙연산",
    achievement: "유리수의 사칙계산의 원리를 이해하고 계산할 수 있다.",
  },
  {
    grade: 1,
    category: "문자와 식",
    code: "9수02-01",
    name: "문자의 사용과 식의 값",
    achievement: "문자를 사용하여 수량 관계를 식으로 나타낸다.",
  },
  {
    grade: 1,
    category: "문자와 식",
    code: "9수02-02",
    name: "일차식의 계산",
    achievement: "일차식의 덧셈과 뺄셈의 원리를 이해하고 계산한다.",
  },
  {
    grade: 1,
    category: "문자와 식",
    code: "9수02-03",
    name: "일차방정식",
    achievement: "등식의 성질을 이해하고 일차방정식의 해를 구한다.",
  },
  {
    grade: 1,
    category: "문자와 식",
    code: "9수02-04",
    name: "일차방정식의 활용",
    achievement: "일차방정식을 활용하여 다양한 문제를 해결한다.",
  },
  {
    grade: 1,
    category: "함수",
    code: "9수03-01",
    name: "함수의 개념",
    achievement: "함수의 개념을 이해하고 함숫값을 구한다.",
  },
  {
    grade: 1,
    category: "기하",
    code: "9수04-01",
    name: "기본 도형과 작도",
    achievement: "점 · 선 · 면의 위치 관계를 이해하고 삼각형을 작도한다.",
  },
  {
    grade: 1,
    category: "확률과 통계",
    code: "9수05-01",
    name: "자료의 정리와 해석",
    achievement: "줄기와 잎 그림 · 도수분포표 · 히스토그램으로 자료를 정리한다.",
  },

  /* ───── 중2 ───── */
  {
    grade: 2,
    category: "수와 연산",
    code: "9수01-04",
    name: "유리수와 순환소수",
    achievement: "유리수가 유한소수 또는 순환소수로 표현됨을 이해한다.",
  },
  {
    grade: 2,
    category: "문자와 식",
    code: "9수02-05",
    name: "식의 계산",
    achievement: "지수법칙과 다항식의 곱셈 · 나눗셈을 이해한다.",
  },
  {
    grade: 2,
    category: "문자와 식",
    code: "9수02-06",
    name: "일차부등식",
    achievement: "부등식의 성질을 이해하고 일차부등식의 해를 구한다.",
  },
  {
    grade: 2,
    category: "문자와 식",
    code: "9수02-07",
    name: "연립일차방정식",
    achievement: "미지수가 두 개인 연립일차방정식의 해를 구한다.",
  },
  {
    grade: 2,
    category: "함수",
    code: "9수03-02",
    name: "일차함수와 그래프",
    achievement: "일차함수의 그래프의 성질과 식을 구한다.",
  },
  {
    grade: 2,
    category: "함수",
    code: "9수03-03",
    name: "일차함수의 활용",
    achievement: "일차함수를 활용하여 실생활 문제를 해결한다.",
  },
  {
    grade: 2,
    category: "기하",
    code: "9수04-02",
    name: "삼각형의 성질",
    achievement: "이등변삼각형의 성질과 삼각형의 외심 · 내심을 이해한다.",
  },
  {
    grade: 2,
    category: "기하",
    code: "9수04-03",
    name: "사각형의 성질",
    achievement: "평행사변형 · 직사각형 · 마름모 · 정사각형의 성질을 이해한다.",
  },
  {
    grade: 2,
    category: "기하",
    code: "9수04-04",
    name: "도형의 닮음",
    achievement: "도형의 닮음을 이해하고 닮음비를 활용한다.",
  },
  {
    grade: 2,
    category: "확률과 통계",
    code: "9수05-02",
    name: "경우의 수와 확률",
    achievement: "경우의 수와 확률의 개념을 이해하고 구한다.",
  },

  /* ───── 중3 ───── */
  {
    grade: 3,
    category: "수와 연산",
    code: "9수01-05",
    name: "제곱근과 실수",
    achievement: "제곱근의 뜻과 실수의 분류를 이해한다.",
  },
  {
    grade: 3,
    category: "수와 연산",
    code: "9수01-06",
    name: "근호를 포함한 식의 계산",
    achievement: "근호를 포함한 식의 사칙계산을 한다.",
  },
  {
    grade: 3,
    category: "문자와 식",
    code: "9수02-08",
    name: "다항식의 곱셈과 인수분해",
    achievement: "다항식의 곱셈공식과 인수분해 공식을 이해한다.",
  },
  {
    grade: 3,
    category: "문자와 식",
    code: "9수02-09",
    name: "이차방정식",
    achievement: "이차방정식의 해를 인수분해 · 근의 공식으로 구한다.",
  },
  {
    grade: 3,
    category: "문자와 식",
    code: "9수02-10",
    name: "이차방정식의 활용",
    achievement: "이차방정식을 활용하여 다양한 문제를 해결한다.",
  },
  {
    grade: 3,
    category: "함수",
    code: "9수03-04",
    name: "이차함수와 그래프",
    achievement: "이차함수의 그래프의 성질과 식을 구한다.",
  },
  {
    grade: 3,
    category: "기하",
    code: "9수04-05",
    name: "삼각비",
    achievement: "직각삼각형에서 삼각비의 값을 구하고 활용한다.",
  },
  {
    grade: 3,
    category: "기하",
    code: "9수04-06",
    name: "원과 직선의 위치 관계",
    achievement: "원과 직선의 위치 관계를 이해하고 접선의 성질을 활용한다.",
  },
  {
    grade: 3,
    category: "기하",
    code: "9수04-07",
    name: "원주각",
    achievement: "원주각의 성질을 이해하고 활용한다.",
  },
  {
    grade: 3,
    category: "확률과 통계",
    code: "9수05-03",
    name: "대푯값과 산포도",
    achievement: "평균 · 중앙값 · 최빈값 · 분산 · 표준편차를 이해한다.",
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

export function gradeLabel(g: Grade): string {
  return `중${g}`;
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

/* ───── 평가 차원 후보 (S3-B) ──────────────────────────────
 * 단원별 명시적 후보가 있으면 사용, 없으면 fallback.
 * `default` 가 true 인 항목은 페이지 진입 시 자동 체크.
 * ────────────────────────────────────────────────────── */

export type EvaluationCandidate = {
  key: string;
  description: string;
  default: boolean;
};

const explicitCandidates: Record<string, EvaluationCandidate[]> = {
  "9수02-03": [
    {
      key: "A",
      description: "등식의 성질을 이용한 동치 변형 단계가 명시되어야 함",
      default: true,
    },
    {
      key: "B",
      description: "양변에 같은 수를 더하거나 빼는 절차를 정확히 수행",
      default: true,
    },
    {
      key: "C",
      description: "이항을 사용한 항의 정리 과정이 포함",
      default: false,
    },
    {
      key: "D",
      description: "구한 해를 원래 식에 대입하여 검증",
      default: false,
    },
  ],
  "9수02-07": [
    {
      key: "A",
      description: "두 조건식에서 미지수 두 개를 연립으로 구함",
      default: true,
    },
    {
      key: "B",
      description: "가감법 또는 대입법 중 하나의 표준 절차를 따름",
      default: true,
    },
    {
      key: "C",
      description: "해를 두 원식에 대입하여 모두 성립함을 확인",
      default: false,
    },
  ],
  "9수02-08": [
    {
      key: "A",
      description: "곱셈공식 또는 인수분해 공식을 정확히 적용",
      default: true,
    },
    {
      key: "B",
      description: "공통인수를 먼저 분리하는 절차 포함",
      default: false,
    },
    {
      key: "C",
      description: "완전제곱식·합차공식 등 패턴 인식",
      default: true,
    },
  ],
  "9수02-09": [
    {
      key: "A",
      description: "인수분해 또는 근의 공식 중 하나로 해를 구함",
      default: true,
    },
    {
      key: "B",
      description: "판별식을 통해 해의 개수와 종류를 해석",
      default: false,
    },
    {
      key: "C",
      description: "구한 해를 원식에 대입하여 검증",
      default: true,
    },
    {
      key: "D",
      description: "이차방정식의 활용 문제 풀이 단계 포함",
      default: false,
    },
  ],
  "9수03-02": [
    {
      key: "A",
      description: "기울기와 y 절편의 의미를 식 · 그래프 양쪽에서 해석",
      default: true,
    },
    {
      key: "B",
      description: "두 점 또는 한 점과 기울기에서 일차함수의 식을 구함",
      default: true,
    },
    {
      key: "C",
      description: "그래프의 평행 · 일치 조건을 식의 계수로 해석",
      default: false,
    },
  ],
  "9수04-05": [
    {
      key: "A",
      description: "직각삼각형의 변의 비로 삼각비의 값을 정의",
      default: true,
    },
    {
      key: "B",
      description: "특수각 (30°, 45°, 60°) 의 삼각비 값을 활용",
      default: true,
    },
    {
      key: "C",
      description: "삼각비를 이용한 변의 길이 또는 각의 크기 계산",
      default: false,
    },
  ],
};

function fallbackCandidates(topic: Topic): EvaluationCandidate[] {
  return [
    {
      key: "A",
      description: `${topic.name} 의 핵심 개념과 정의를 정확히 적용`,
      default: true,
    },
    {
      key: "B",
      description: `${topic.name} 의 표준 풀이 절차를 단계별로 수행`,
      default: true,
    },
    {
      key: "C",
      description: "식 또는 그림의 변형이 정의된 성질에 부합",
      default: false,
    },
    {
      key: "D",
      description: "구한 결과를 원래 조건에 대입하여 검증",
      default: false,
    },
  ];
}

export function getEvaluationCandidates(
  topic: Topic,
): EvaluationCandidate[] {
  return explicitCandidates[topic.code] ?? fallbackCandidates(topic);
}
