import { describe, expect, it } from "vitest";
import {
  answerChoiceIndex,
  splitChoices,
} from "../lib/exam-choices";

/*
 * splitChoices — 시험지 조판용 5지선다 보기 분리.
 *
 * 계약: 마커 ①~⑤ 가 "순서대로 모두" 존재할 때만 분리한다.
 * 일부만 있거나 순서가 어긋나면 전체를 본문으로 둔다 (조판이 깨지는 것보다
 * 인라인 유지가 안전).
 */
describe("splitChoices", () => {
  it("표준 5지선다를 본문과 보기 5개로 분리한다", () => {
    const q =
      "이때 a²-b²-c²의 값으로 옳은 것은? ① 8 ② 10 ③ 12 ④ 14 ⑤ 16";
    const { body, choices } = splitChoices(q);
    expect(body).toBe("이때 a²-b²-c²의 값으로 옳은 것은?");
    expect(choices).toEqual(["8", "10", "12", "14", "16"]);
  });

  it("LaTeX 조각이 든 보기도 그대로 보존한다", () => {
    const q = "다음 중 옳은 것은? ① x^{2} ② 2 x + 1 ③ \\sqrt{3} ④ x - 1 ⑤ 0";
    const { choices } = splitChoices(q);
    expect(choices).toEqual(["x^{2}", "2 x + 1", "\\sqrt{3}", "x - 1", "0"]);
  });

  it("마커가 없는 주관식은 분리하지 않는다", () => {
    const q = "B와 C의 부피의 합에서 A의 부피를 뺀 식을 간단히 나타내어라.";
    expect(splitChoices(q)).toEqual({ body: q, choices: null });
  });

  it("마커가 일부만 있으면 분리하지 않는다", () => {
    const q = "다음 중 옳은 것은? ① 8 ② 10 ③ 12";
    expect(splitChoices(q)).toEqual({ body: q, choices: null });
  });

  it("마커 순서가 어긋나면 분리하지 않는다", () => {
    const q = "② 번 문장을 보고 답하라. ① 8 ③ 12 ④ 14 ⑤ 16";
    expect(splitChoices(q)).toEqual({ body: q, choices: null });
  });

  it("빈 보기가 생기면 분리하지 않는다", () => {
    const q = "옳은 것은? ① ② 10 ③ 12 ④ 14 ⑤ 16";
    expect(splitChoices(q)).toEqual({ body: q, choices: null });
  });
});

describe("answerChoiceIndex", () => {
  const choices = ["8", "10", "12", "14", "16"];

  it("정답 값이 보기와 일치하면 0-base 인덱스를 준다", () => {
    expect(answerChoiceIndex("12", choices)).toBe(2);
  });

  it("공백 차이는 무시한다", () => {
    expect(answerChoiceIndex("3x+8", ["3 x + 8", "x", "1", "2", "0"])).toBe(0);
  });

  it("일치하는 보기가 없으면 null", () => {
    expect(answerChoiceIndex("99", choices)).toBeNull();
  });

  it("둘 이상 일치하면 모호하므로 null", () => {
    expect(answerChoiceIndex("8", ["8", "8", "1", "2", "3"])).toBeNull();
  });

  it("빈 정답은 null", () => {
    expect(answerChoiceIndex("  ", choices)).toBeNull();
  });
});
