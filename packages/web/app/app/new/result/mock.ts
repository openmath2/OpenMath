import type { Topic } from "../topic/data";

/* ─────────────────────────────────────────────────────────────
 * Mock 결과 생성기.
 *
 * MVP 단계에서는 agent 서버 응답을 받지 않고 URL params 기반으로
 * 결정적인 mock 문항 세트를 만든다. S5 UI 의 모든 시각 상태
 * (pass-structural / pass-conceptual / warn / fail) 를 노출하도록
 * 단원별로 4 개 문항을 구성한다.
 *
 * 실제 agent 연동 시 본 모듈을 fetch + parse 호출로 교체.
 * ──────────────────────────────────────────────────────────── */

export type ResultStatus = "pass" | "warn" | "fail";

export type ResultProblem = {
  id: string;
  number: number;
  isomorphism: "structural" | "conceptual";
  status: ResultStatus;
  questionLatex: string;
  answerLatex: string;
  solutionLatex: string;
  preservedDims: string[];
  missingDims: string[];
  failReason: string | null;
};

type TopicTemplate = {
  questions: string[];
  answers: string[];
  solutions: string[];
};

const templates: Record<string, TopicTemplate> = {
  "9수02-03": {
    questions: [
      "3x + 5 = 14",
      "4(x - 1) = 8",
      "2x - 6 = x + 1",
      "\\frac{x}{2} + 3 = 5",
    ],
    answers: ["x = 3", "x = 3", "x = 7", "x = 4"],
    solutions: [
      "3x = 9, \\; x = 3",
      "4x - 4 = 8, \\; 4x = 12, \\; x = 3",
      "2x - x = 1 + 6, \\; x = 7",
      "\\frac{x}{2} = 2, \\; x = 4",
    ],
  },
  "9수02-09": {
    questions: [
      "x^{2} - 5x + 6 = 0",
      "x^{2} + 4x - 12 = 0",
      "2x^{2} - 7x + 3 = 0",
      "x^{2} - 4x + 4 = 0",
    ],
    answers: ["x = 2,\\; 3", "x = 2,\\; -6", "x = 3,\\; \\tfrac{1}{2}", "x = 2"],
    solutions: [
      "(x-2)(x-3) = 0",
      "(x-2)(x+6) = 0",
      "(2x-1)(x-3) = 0",
      "(x-2)^{2} = 0",
    ],
  },
  "9수02-07": {
    questions: [
      "\\begin{cases} x + y = 5 \\\\ x - y = 1 \\end{cases}",
      "\\begin{cases} 2x + y = 7 \\\\ x - y = 2 \\end{cases}",
      "\\begin{cases} 3x + 2y = 12 \\\\ x + y = 5 \\end{cases}",
      "\\begin{cases} x + 2y = 8 \\\\ 2x + y = 7 \\end{cases}",
    ],
    answers: [
      "x = 3,\\; y = 2",
      "x = 3,\\; y = 1",
      "x = 2,\\; y = 3",
      "x = 2,\\; y = 3",
    ],
    solutions: [
      "두 식 합 → 2x = 6, \\; x = 3, \\; y = 2",
      "두 식 합 → 3x = 9, \\; x = 3, \\; y = 1",
      "치환 후 정리 → x = 2, \\; y = 3",
      "가감법 → x = 2, \\; y = 3",
    ],
  },
  "9수04-05": {
    questions: [
      "\\sin 30^{\\circ}",
      "\\cos 60^{\\circ}",
      "\\tan 45^{\\circ}",
      "\\sin 60^{\\circ} \\cdot \\cos 30^{\\circ}",
    ],
    answers: [
      "\\frac{1}{2}",
      "\\frac{1}{2}",
      "1",
      "\\frac{3}{4}",
    ],
    solutions: [
      "30° 직각삼각형 정의에서",
      "60° 의 cos = 30° 의 sin",
      "정의에 의해 \\tan 45° = 1",
      "\\tfrac{\\sqrt{3}}{2} \\cdot \\tfrac{\\sqrt{3}}{2} = \\tfrac{3}{4}",
    ],
  },
};

function genericTemplate(topic: Topic): TopicTemplate {
  return {
    questions: [
      `${topic.name} \\;\\text{문항} \\; 1`,
      `${topic.name} \\;\\text{문항} \\; 2`,
      `${topic.name} \\;\\text{문항} \\; 3`,
      `${topic.name} \\;\\text{문항} \\; 4`,
    ],
    answers: ["\\text{답 1}", "\\text{답 2}", "\\text{답 3}", "\\text{답 4}"],
    solutions: [
      "\\text{표준 풀이 절차에 따라}",
      "\\text{식의 동치 변형 후}",
      "\\text{공식 적용 후 정리}",
      "\\text{대입하여 검증}",
    ],
  };
}

export function generateMockResults(
  topic: Topic,
  mode: "structural" | "conceptual",
  dims: string[],
): ResultProblem[] {
  const t = templates[topic.code] ?? genericTemplate(topic);
  /* 4 문항: pass / pass / warn / fail — UI 상태 demo 용. */
  const layouts: ReadonlyArray<{
    status: ResultStatus;
    iso: "structural" | "conceptual";
    failReason: string | null;
    missingDimIndex: number | null;
  }> = [
    { status: "pass", iso: mode, failReason: null, missingDimIndex: null },
    {
      status: "pass",
      iso: mode === "structural" ? "conceptual" : "structural",
      failReason: null,
      missingDimIndex: null,
    },
    {
      status: "warn",
      iso: mode,
      failReason: null,
      missingDimIndex: dims.length >= 2 ? dims.length - 1 : null,
    },
    {
      status: "fail",
      iso: mode,
      failReason: "독립 재풀이에서 답 불일치 — 검토 필요",
      missingDimIndex: null,
    },
  ];

  return layouts.map((layout, i) => {
    const dimsKept =
      layout.missingDimIndex === null
        ? [...dims]
        : dims.filter((_, idx) => idx !== layout.missingDimIndex);
    const dimsMissing =
      layout.missingDimIndex === null
        ? []
        : [dims[layout.missingDimIndex] ?? ""];
    return {
      id: `${topic.code}-${i + 1}`,
      number: i + 1,
      isomorphism: layout.iso,
      status: layout.status,
      questionLatex: t.questions[i] ?? t.questions[0] ?? "",
      answerLatex: t.answers[i] ?? t.answers[0] ?? "",
      solutionLatex: t.solutions[i] ?? t.solutions[0] ?? "",
      preservedDims: dimsKept,
      missingDims: dimsMissing,
      failReason: layout.failReason,
    };
  });
}
