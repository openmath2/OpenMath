import type { GenerateRequest, GeneratedProblem } from "../schemas/index.js";
import { getGenerateRequestTopicCode } from "../schemas/index.js";

export function deterministicTopicGuardHints(
  request: GenerateRequest,
  candidate: GeneratedProblem,
): string[] {
  const topicCode = getGenerateRequestTopicCode(request);
  const text = `${candidate.question_text}\n${candidate.expected_answer}`;
  if (topicCode === "9수01-02" && hasRadicalNotation(text)) {
    return [
      "정수와 유리수 단원 문제여야 합니다. sqrt, 제곱근, 근호 계산 문제를 만들지 말고 정수/유리수의 분류, 부호, 대소 관계, 정수가 아닌 유리수 판별을 묻도록 다시 생성하세요.",
    ];
  }
  if (topicCode === "9수01-04" && hasUnstableRepeatingDecimalNotation(candidate.question_text)) {
    return [
      "유리수와 순환소수 단원에서는 overdot 또는 점 표기 선택지 판별 문제를 만들지 마세요. 순환소수를 분수로 바꾸거나 순환마디를 plain text로 답하게 다시 생성하세요.",
    ];
  }
  if (topicCode === "9수01-06" && hasCompoundRadicalSubstitution(candidate.question_text)) {
    return [
      "근호 계산 단원에서는 a, b에 각각 복합 근호식을 대입하는 긴 문제를 피하세요. 하나의 근호 포함 식을 직접 간단히 하는 문제로 다시 생성하세요.",
    ];
  }
  if (topicCode === "9수02-08" && asksCommonFactorAcrossPolynomials(candidate.question_text)) {
    return [
      "다항식의 곱셈과 인수분해 단원에서는 두 다항식의 공통 인수를 묻지 말고, 하나의 다항식을 전개하거나 인수분해하는 직접 계산 문제로 다시 생성하세요.",
    ];
  }
  if (topicCode === "9수02-01" && hasMultipartValueQuestion(candidate.question_text)) {
    return [
      "문자의 사용과 식의 값 단원에서는 대입 계산까지 함께 묻는 (1)(2) 복합 문항을 피하고, 한 가지 식만 묻는 단일 문항으로 다시 생성하세요.",
    ];
  }
  if ((topicCode === "9수05-01" || topicCode === "9수05-03") && hasMultiStatementChoice(candidate.question_text)) {
    return [
      "통계 단원에서는 여러 명제의 참거짓을 모두 고르는 보기형을 피하고, 평균/상대도수/중앙값/분산 중 하나를 직접 계산하는 단일 문항으로 다시 생성하세요.",
    ];
  }
  if (topicCode === "9수02-09" && asksEquationWithVerificationAddOn(candidate.question_text)) {
    return [
      "이차방정식 단원에서는 해를 구한 뒤 특정 값이 해인지 확인하는 복합 문항을 피하고, 이차방정식의 해만 구하는 단일 문항으로 다시 생성하세요.",
    ];
  }
  if (topicCode === "9수04-05" && hasComplexTrigonometricLengthSum(candidate.question_text)) {
    return [
      "삼각비 단원에서는 근호가 섞인 여러 길이의 합산 문항을 피하고, 직각삼각형에서 한 변의 길이 하나를 구하는 단일 문항으로 다시 생성하세요.",
    ];
  }
  if (topicCode === "9수04-04" && asksSimilarityPerimeter(candidate.question_text)) {
    return [
      "도형의 닮음 단원에서는 닮음비와 둘레를 함께 계산하는 문항을 피하고, 대응하는 변 또는 한 변의 길이를 직접 묻는 단일 문항으로 다시 생성하세요.",
    ];
  }
  if (candidate.generation_kind === "geometry" && dependsOnUnseenFigure(candidate.question_text)) {
    return [
      "그림에 의존하는 문제를 만들지 마세요. 그림 없이 텍스트만으로 모든 점, 길이, 각, 위치 관계가 결정되는 문제로 다시 생성하세요.",
    ];
  }
  return [];
}

export function deterministicGuardReplacement(
  request: GenerateRequest,
  candidate: GeneratedProblem,
): GeneratedProblem | null {
  const topicCode = getGenerateRequestTopicCode(request);
  if (topicCode === "9수02-01" && hasMultipartValueQuestion(candidate.question_text)) {
    return replaceCandidate(candidate, {
      question_text: "연필 한 자루는 700원, 공책 한 권은 1200원이다. 연필 a자루와 공책 b권을 살 때 필요한 금액을 a, b를 사용한 식으로 나타내시오.",
      expected_answer: "700a + 1200b원",
      proposed_solution_trace: "연필 금액 700a와 공책 금액 1200b를 더한다.",
    });
  }
  if (topicCode === "9수02-08" && asksCommonFactorAcrossPolynomials(candidate.question_text)) {
    return replaceCandidate(candidate, {
      question_text: "다항식 x**2 + 5*x + 6을 인수분해하시오.",
      expected_answer: "(x+2)(x+3)",
      proposed_solution_trace: "곱해서 6, 더해서 5가 되는 두 수 2와 3을 찾아 인수분해한다.",
    });
  }
  if (topicCode === "9수05-03" && hasMultiStatementChoice(candidate.question_text)) {
    return replaceCandidate(candidate, {
      question_text: "자료 4, 6, 8, 10, 12의 평균을 구하시오.",
      expected_answer: "8",
      proposed_solution_trace: "다섯 변량의 합 40을 자료의 개수 5로 나눈다.",
    });
  }
  if (topicCode === "9수05-01" && hasMultiStatementChoice(candidate.question_text)) {
    return replaceCandidate(candidate, {
      question_text: "전체 학생 40명 중 어느 계급에 속한 학생이 8명이다. 이 계급의 상대도수를 구하시오.",
      expected_answer: "0.2",
      proposed_solution_trace: "상대도수는 해당 계급의 도수 8을 전체 도수 40으로 나누어 구한다.",
    });
  }
  if (topicCode === "9수02-09" && asksEquationWithVerificationAddOn(candidate.question_text)) {
    return replaceCandidate(candidate, {
      question_text: "다음 이차방정식 (x-4)(x+1)=0의 해를 구하시오.",
      expected_answer: "4, -1",
      proposed_solution_trace: "두 인수 중 하나가 0이 되어야 하므로 x=4 또는 x=-1이다.",
    });
  }
  if (topicCode === "9수04-05" && hasComplexTrigonometricLengthSum(candidate.question_text)) {
    return replaceCandidate(candidate, {
      question_text: "직각삼각형 ABC에서 angle C = 90도, angle A = 30도, AB = 10일 때, BC의 길이를 구하시오.",
      expected_answer: "5",
      proposed_solution_trace: "30도 각의 맞은편 변은 빗변의 1/2이므로 BC = 5이다.",
    });
  }
  if (topicCode === "9수04-04" && asksSimilarityPerimeter(candidate.question_text)) {
    return replaceCandidate(candidate, {
      question_text: "삼각형 ABC와 삼각형 DEF가 닮음이고 대응은 A↔D, B↔E, C↔F이다. 변 AB에 대응하는 변을 쓰시오.",
      expected_answer: "DE",
      proposed_solution_trace: "닮음의 대응 순서에서 A와 D, B와 E가 대응하므로 AB에 대응하는 변은 DE이다.",
    });
  }
  return null;
}

function replaceCandidate(
  candidate: GeneratedProblem,
  replacement: Pick<GeneratedProblem, "question_text" | "expected_answer" | "proposed_solution_trace">,
): GeneratedProblem {
  return { ...candidate, ...replacement };
}

function hasRadicalNotation(text: string): boolean {
  return /(?:\\sqrt|sqrt\s*\(|sqrt\s*\{|√|근호|제곱근)/u.test(text);
}

function hasUnstableRepeatingDecimalNotation(text: string): boolean {
  return /\u0307|[①②③④⑤].*순환소수|순환소수[\s\S]*[①②③④⑤]/u.test(text);
}

function dependsOnUnseenFigure(text: string): boolean {
  return /(?:오른쪽|왼쪽|다음)\s*그림|그림에서/u.test(text);
}

function hasCompoundRadicalSubstitution(text: string): boolean {
  return /(?:^|[\s,])a\s*=/.test(text) && /(?:^|[\s,])b\s*=/.test(text) && hasRadicalNotation(text);
}

function asksCommonFactorAcrossPolynomials(text: string): boolean {
  return /두\s*다항식|공통(?:으로)?\s*(?:들어\s*있는\s*)?인수/u.test(text);
}

function hasMultipartValueQuestion(text: string): boolean {
  return /\(1\)[\s\S]*\(2\)/u.test(text);
}

function hasMultiStatementChoice(text: string): boolean {
  return /<보기>|다음\s*설명\s*중|옳지\s*않은\s*것|옳은\s*것|옳은\s*것을\s*모두|옳은\s*것은\s*모두/u.test(text);
}

function hasComplexTrigonometricLengthSum(text: string): boolean {
  return /(?:\\sqrt|sqrt|√|BC\s*\+\s*AC|AC\s*\+\s*BC)/u.test(text);
}

function asksEquationWithVerificationAddOn(text: string): boolean {
  return /해인지\s*확인|대입하여\s*확인|확인하시오/u.test(text);
}

function asksSimilarityPerimeter(text: string): boolean {
  return /닮음[\s\S]*둘레|둘레[\s\S]*닮음/u.test(text);
}
