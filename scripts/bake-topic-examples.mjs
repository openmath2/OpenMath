#!/usr/bin/env node
/**
 * bake-topic-examples.mjs
 *
 * Demo path 단원(3개)에 대해 corpus 에서 양질의 예시 문제를 추출하여
 * `packages/web/app/app/new/topic/examples.json` 으로 굽는다.
 *
 * 정공법(D-13 mapping YAML) 전 임시 인라인 mini-매핑.
 * 향후 `packages/agent/data/curriculum/mapping-2022-to-2015.yaml` 로 이관.
 *
 * 사용법:
 *   node scripts/bake-topic-examples.mjs
 *   CORPUS_JSONL=... node scripts/bake-topic-examples.mjs   # 경로 override
 */

import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_PATH = resolve(
  ROOT,
  "packages/web/app/app/new/topic/examples.json",
);
const CORPUS = process.env.CORPUS_JSONL ?? resolve(
  "/Users/tw81512/dev/AI_HUB_data/rag_problem_generation_dataset/openmath_rag_records.jsonl",
);
const PER_UNIT = 3;

/** UI 2022 코드 → corpus 매칭 룰 (topic_name keyword + grade).
 *  D-13 매핑 도입 전 임시. 매칭 못 찾는 단원은 examples.json 에 미포함.
 */
const DEMO_UNITS = [
  { ui_code: "9수01-01", ui_name: "소인수분해", grade: 1,
    topic_includes: ["소인수", "소수와 합성수", "약수", "배수", "최대공약수", "최소공배수"],
    topic_excludes: ["방정식", "함수", "유리수"] },
  { ui_code: "9수01-02", ui_name: "정수와 유리수", grade: 1,
    topic_includes: ["정수와 유리수", "수직선", "절댓값", "대소 관계"],
    topic_excludes: ["방정식", "함수", "사칙"] },
  { ui_code: "9수01-03", ui_name: "유리수의 사칙연산", grade: 1,
    topic_includes: ["혼합 계산", "유리수의 덧셈", "유리수의 뺄셈", "유리수의 곱셈", "유리수의 나눗셈", "사칙계산"],
    topic_excludes: ["방정식", "일차식", "함수"] },
  { ui_code: "9수02-01", ui_name: "문자의 사용과 식의 값", grade: 1,
    topic_includes: ["문자의 사용", "식의 값", "대입"],
    topic_excludes: ["방정식", "함수", "일차식"] },
  { ui_code: "9수02-02", ui_name: "일차식의 계산", grade: 1,
    topic_includes: ["일차식", "동류항"],
    topic_excludes: ["방정식", "함수"] },
  { ui_code: "9수02-03", ui_name: "일차방정식", grade: 1,
    topic_includes: ["일차방정식", "방정식의 해", "방정식의 뜻"],
    topic_excludes: ["이차", "연립", "부등식", "활용"] },
  { ui_code: "9수02-04", ui_name: "일차방정식의 활용", grade: 1,
    topic_includes: ["일차방정식", "활용"],
    topic_excludes: ["이차", "함수", "부등식"] },
  { ui_code: "9수03-01", ui_name: "함수의 개념", grade: 1,
    topic_includes: ["함수", "함숫값"],
    topic_excludes: ["일차함수", "이차함수", "방정식"] },
  { ui_code: "9수04-01", ui_name: "기본 도형과 작도", grade: 1,
    topic_includes: ["작도", "맞꼭지각", "동위각", "엇각", "기본 도형"],
    topic_excludes: ["방정식", "함수"] },
  { ui_code: "9수05-01", ui_name: "자료의 정리와 해석", grade: 1,
    topic_includes: ["줄기와 잎", "도수분포", "히스토그램", "상대도수"],
    topic_excludes: ["함수", "방정식"] },

  { ui_code: "9수01-04", ui_name: "유리수와 순환소수", grade: 2,
    topic_includes: ["순환소수", "유한소수", "기약분수", "무한소수"],
    topic_excludes: ["방정식", "함수"] },
  { ui_code: "9수02-05", ui_name: "식의 계산", grade: 2,
    topic_includes: ["지수법칙", "다항식의 곱셈", "다항식의 나눗셈", "다항식의 덧셈"],
    topic_excludes: ["이차", "이차함수", "방정식의 해"] },
  { ui_code: "9수02-06", ui_name: "일차부등식", grade: 2,
    topic_includes: ["부등식", "일차부등식"],
    topic_excludes: ["함수", "이차"] },
  { ui_code: "9수02-07", ui_name: "연립일차방정식", grade: 2,
    topic_includes: ["연립", "연립방정식", "가감법", "대입법"],
    topic_excludes: ["이차", "함수"] },
  { ui_code: "9수03-02", ui_name: "일차함수와 그래프", grade: 2,
    topic_includes: ["일차함수", "기울기", "y절편"],
    topic_excludes: ["이차", "활용", "방정식의 활용"] },
  { ui_code: "9수03-03", ui_name: "일차함수의 활용", grade: 2,
    topic_includes: ["일차함수", "활용"],
    topic_excludes: ["이차", "방정식"] },
  { ui_code: "9수04-02", ui_name: "삼각형의 성질", grade: 2,
    topic_includes: ["이등변삼각형", "삼각형의 성질", "외심", "내심"],
    topic_excludes: ["함수", "방정식", "닮음"] },
  { ui_code: "9수04-03", ui_name: "사각형의 성질", grade: 2,
    topic_includes: ["평행사변형", "직사각형", "마름모", "정사각형", "사각형의 성질"],
    topic_excludes: ["함수", "방정식", "닮음"] },
  { ui_code: "9수04-04", ui_name: "도형의 닮음", grade: 2,
    topic_includes: ["닮음", "닮음비", "평행선 사이의 선분"],
    topic_excludes: ["함수", "방정식"] },
  { ui_code: "9수05-02", ui_name: "경우의 수와 확률", grade: 2,
    topic_includes: ["경우의 수", "확률", "사건"],
    topic_excludes: ["함수", "방정식", "표준편차", "대푯값"] },

  { ui_code: "9수01-05", ui_name: "제곱근과 실수", grade: 3,
    topic_includes: ["제곱근", "근호", "무리수", "실수의 분류", "실수의 대소"],
    topic_excludes: ["함수", "방정식", "도형", "삼각비"] },
  { ui_code: "9수01-06", ui_name: "근호를 포함한 식의 계산", grade: 3,
    topic_includes: ["근호를 포함한", "근호", "분모의 유리화"],
    topic_excludes: ["함수", "방정식", "도형", "삼각비"] },
  { ui_code: "9수02-08", ui_name: "다항식의 곱셈과 인수분해", grade: 3,
    topic_includes: ["곱셈 공식", "곱셈공식", "인수분해", "다항식의 곱셈"],
    topic_excludes: ["이차방정식", "이차함수", "삼각비"] },
  { ui_code: "9수02-09", ui_name: "이차방정식", grade: 3,
    topic_includes: ["이차방정식"],
    topic_excludes: ["함수", "그래프", "활용"] },
  { ui_code: "9수02-10", ui_name: "이차방정식의 활용", grade: 3,
    topic_includes: ["이차방정식", "활용"],
    topic_excludes: ["함수", "그래프"] },
  { ui_code: "9수03-04", ui_name: "이차함수와 그래프", grade: 3,
    topic_includes: ["이차함수"],
    topic_excludes: ["방정식의 해", "삼각비"] },
  { ui_code: "9수04-05", ui_name: "삼각비", grade: 3,
    topic_includes: ["삼각비"],
    topic_excludes: ["함수", "방정식"] },
  { ui_code: "9수04-06", ui_name: "원과 직선의 위치 관계", grade: 3,
    topic_includes: ["원의 접선", "원의 현", "원과 직선"],
    topic_excludes: ["원주각", "함수", "방정식"] },
  { ui_code: "9수04-07", ui_name: "원주각", grade: 3,
    topic_includes: ["원주각"],
    topic_excludes: ["함수", "방정식"] },
  { ui_code: "9수05-03", ui_name: "대푯값과 산포도", grade: 3,
    topic_includes: ["평균", "중앙값", "최빈값", "분산", "표준편차", "산포도"],
    topic_excludes: ["함수", "방정식", "도형"] },
];

function topicNameMatches(topicName, includes, excludes) {
  if (!topicName) return false;
  const tn = topicName;
  if (!includes.some((kw) => tn.includes(kw))) return false;
  if (excludes.some((kw) => tn.includes(kw))) return false;
  return true;
}

/** preview 로 보여줄 수 있는 문제인지. */
function isUsablePreview(record) {
  const p = record.problem ?? {};
  const q = (p.question_text ?? "").trim();
  const a = (p.answer_text ?? "").trim();
  if (q.length < 25 || q.length > 280) return false;
  if (!a) return false;
  if ((record.quality ?? {}).is_usable === false) return false;
  // 객관식 답이 ①~⑤ 만 있는 경우 미리보기 가치 낮음 → 제외
  if (/^[①②③④⑤]$/.test(a)) return false;
  // 이미지 의존 문제는 텍스트가 "다음 그림 / 도형 / <보기>" 등으로 시작하면 제외 (preview 부적합).
  // 이미지 metadata 만 있고 텍스트가 자족적인 경우는 통과.
  if ((record.media ?? {}).question_image_relpath) {
    if (/^(다음\s*그림|아래\s*그림|그림과\s*같이|<\s*보기\s*>|다음\s*도형|다음\s*표)/.test(q)) {
      return false;
    }
  }
  return true;
}

/** 단일 단원에 대한 후보를 점수 정렬 후 PER_UNIT 개 선택. */
function pickForUnit(candidates) {
  // 점수: easy=2, medium=1, hard=0 + 답 길이 적당함 보너스
  const scored = candidates.map((c) => {
    const d = c.problem.difficulty;
    let score = d === "easy" ? 2 : d === "medium" ? 1 : 0;
    const aLen = (c.problem.answer_text ?? "").length;
    if (aLen >= 1 && aLen <= 40) score += 1;
    const eLen = (c.problem.explanation_text ?? "").length;
    if (eLen > 0) score += 0.5;
    return { c, score };
  });

  // difficulty 분산: easy / medium 골고루
  scored.sort((a, b) => b.score - a.score);
  const picked = [];
  const seen = new Set();
  // 1차 패스: 쉬운 것부터 다양한 topic_name 으로
  for (const { c } of scored) {
    if (picked.length >= PER_UNIT) break;
    const tn = c.curriculum.topic_name ?? "";
    if (seen.has(tn)) continue;
    picked.push(c);
    seen.add(tn);
  }
  // 2차 패스: 부족하면 점수순으로 채움
  for (const { c } of scored) {
    if (picked.length >= PER_UNIT) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}

async function main() {
  console.log(`[bake] corpus: ${CORPUS}`);
  console.log(`[bake] out:    ${OUT_PATH}`);

  /** ui_code -> candidates[] */
  const buckets = new Map(DEMO_UNITS.map((u) => [u.ui_code, []]));

  const rl = createInterface({
    input: createReadStream(CORPUS, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let total = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    total += 1;
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    const c = r.curriculum ?? {};
    if (c.school_level !== "middle") continue;
    if (!isUsablePreview(r)) continue;

    for (const unit of DEMO_UNITS) {
      if (c.grade !== unit.grade) continue;
      if (
        !topicNameMatches(
          c.topic_name,
          unit.topic_includes,
          unit.topic_excludes,
        )
      ) {
        continue;
      }
      buckets.get(unit.ui_code).push(r);
      break; // 한 record 는 한 단원에만
    }
  }

  console.log(`[bake] scanned ${total.toLocaleString()} records`);

  /** out 구조: { "<ui_code>": [{ id, ... }, ...] } */
  const out = {
    generated_at: new Date().toISOString(),
    corpus_source: CORPUS.split("/").pop(),
    note: "임시 mini-매핑 기반. D-13 도입 후 mapping-2022-to-2015.yaml 로 이관.",
    units: {},
  };

  for (const unit of DEMO_UNITS) {
    const candidates = buckets.get(unit.ui_code);
    const picked = pickForUnit(candidates);
    out.units[unit.ui_code] = {
      ui_name: unit.ui_name,
      grade: unit.grade,
      candidate_pool: candidates.length,
      examples: picked.map((r) => ({
        id: r.id.problem_id,
        achievement_code_2015: r.curriculum.achievement_code,
        topic_name_2015: r.curriculum.topic_name,
        difficulty: r.problem.difficulty,
        problem_type: r.problem.problem_type,
        question_text: (r.problem.question_text ?? "").trim(),
        answer_text: (r.problem.answer_text ?? "").trim(),
      })),
    };
    console.log(
      `[bake] ${unit.ui_code} (${unit.ui_name}): pool=${candidates.length}, picked=${picked.length}`,
    );
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`[bake] wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("[bake] FAILED:", err);
  process.exit(1);
});
