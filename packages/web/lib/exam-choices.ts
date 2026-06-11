/* 객관식 보기(①~⑤) 분리 — 시험지 조판용.
 *
 * 에이전트가 주는 question_latex 는 5지선다 보기까지 본문 끝에 인라인으로
 * 붙어 온다 ("...옳은 것은? ① 8 ② 10 ③ 12 ④ 14 ⑤ 16"). 시험지에서는
 * 보기를 별도 행으로 조판해야 하므로, 표준 마커 ①~⑤ 가 순서대로 모두
 * 존재할 때만 본문과 보기를 분리한다. 그 외(주관식, 마커 일부만 존재,
 * 순서 어긋남)는 전체를 본문으로 둔다.
 */

export const CHOICE_MARKERS = ["①", "②", "③", "④", "⑤"] as const;

export type SplitQuestion = {
  body: string;
  choices: string[] | null;
};

export function splitChoices(question: string): SplitQuestion {
  const whole: SplitQuestion = { body: question, choices: null };
  const start = question.indexOf(CHOICE_MARKERS[0]);
  if (start === -1) return whole;

  const tail = question.slice(start);
  const positions: number[] = [];
  for (const marker of CHOICE_MARKERS) {
    const pos = tail.indexOf(marker);
    const prev = positions[positions.length - 1] ?? -1;
    if (pos === -1 || pos <= prev) return whole;
    positions.push(pos);
  }

  const choices: string[] = [];
  for (let k = 0; k < positions.length; k++) {
    const from = (positions[k] ?? 0) + 1;
    const to = k + 1 < positions.length ? positions[k + 1] : tail.length;
    const choice = tail.slice(from, to).trim();
    if (choice.length === 0) return whole;
    choices.push(choice);
  }
  return { body: question.slice(0, start).trim(), choices };
}

/* 정답 문자열이 보기 중 정확히 하나와 일치하면 그 인덱스(0-base)를 준다.
 * 빠른 정답표에서 "12" 대신 "③" 으로 표기하기 위한 매핑. 공백 차이
 * ("3x+8" vs "3 x + 8")는 무시하고, 둘 이상 일치하면 모호하므로 포기.
 */
export function answerChoiceIndex(
  answer: string,
  choices: readonly string[],
): number | null {
  const norm = (s: string): string => s.replace(/\s+/g, "");
  const target = norm(answer);
  if (target.length === 0) return null;
  const hits: number[] = [];
  choices.forEach((choice, index) => {
    if (norm(choice) === target) hits.push(index);
  });
  const only = hits[0];
  return hits.length === 1 && only !== undefined ? only : null;
}
