/**
 * Agent 단독 검증 — RAG Client.
 * 실제 코퍼스가 없으므로 임시 fixture를 만들어 createInMemoryRagClient 호출.
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createInMemoryRagClient } from "../src/tools/rag-client.js";

async function writeFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "openmath-rag-real-"));
  const path = join(dir, "corpus.jsonl");
  const records = [
    {
      schema_version: "openmath-rag-record-v1",
      id: {
        problem_id: "111:train:middle-quadratic-001",
        source_dataset: "111",
        split: "train",
        item_id: "middle-quadratic-001",
        source_label_type: "problem_label",
      },
      curriculum: {
        active_curriculum: "2022 개정",
        school_level: "middle",
        grade: 3,
        semester: 1,
        topic_code: "9수04-12",
        topic_name: "이차방정식의 풀이",
        achievement_code: "9수04-12",
        achievement_standard: "이차방정식을 풀 수 있다.",
        achievement_confidence: 0.95,
      },
      problem: {
        question_text: "이차방정식 x^2 - 5x + 6 = 0 의 해를 구하시오.",
        choice_blocks: [],
        answer_text: "x = 2 or x = 3",
        explanation_text: "(x-2)(x-3)=0",
        problem_type: "subjective",
        difficulty: "medium",
      },
      rag: {
        retrieval_text: "이차방정식 풀이 인수분해",
        embedding_text: "이차방정식 x^2 - 5x + 6 = 0",
      },
      media: { question_image_relpath: null, answer_image_relpath: null },
      quality: { is_usable: true },
      source_trace: {
        original_question_json_relpath: null,
        original_answer_json_relpath: null,
      },
    },
  ];
  await writeFile(path, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return path;
}

async function main() {
  const jsonlPath = await writeFixture();
  console.log("[fixture]", jsonlPath);

  const rag = createInMemoryRagClient({ jsonlPath });

  const results = await rag.search({
    school_level: "middle",
    grade: 3,
    topic_name: "이차방정식",
    problem_type: "subjective",
    difficulty: "medium",
    k: 3,
  });

  console.log("RAG search results:", JSON.stringify(results, null, 2));
  console.log(`총 ${results.length} 건 반환됨`);
}

main().catch((err) => {
  console.error("RUNTIME ERROR:", err);
  process.exit(1);
});
