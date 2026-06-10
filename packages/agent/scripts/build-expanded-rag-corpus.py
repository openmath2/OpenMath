#!/usr/bin/env python3
# pyright: reportAny=false, reportExplicitAny=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnusedCallResult=false
"""Build local-only expanded OpenMath RAG corpora from AI Hub data.

Inputs are intentionally outside the git working tree by default:
- 66,800 cleaned problem records: ~/Downloads/AI_HUB_data/AI_HUB/rag_problem_generation_dataset
- AI Hub 479 high-school OCR labels: ~/Downloads/AI_HUB_data/downloads_479_high_printed

Outputs are JSON/JSONL files under packages/agent/data/corpus/. That directory is
git-ignored except for the tiny fixture, so generated corpus data stays local.
"""

from __future__ import annotations

import argparse
import json
import re
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
AGENT_DIR = ROOT / "packages" / "agent"
DEFAULT_PROBLEM_DATASET = Path.home() / "Downloads/AI_HUB_data/AI_HUB/rag_problem_generation_dataset"
DEFAULT_OCR_DATASET = Path.home() / "Downloads/AI_HUB_data/downloads_479_high_printed"
DEFAULT_OUTPUT = AGENT_DIR / "data/corpus/openmath_rag_records_expanded.jsonl"
DEFAULT_OCR_OUTPUT = AGENT_DIR / "data/corpus/openmath_high_ocr_records.jsonl"
DEFAULT_REPORT = AGENT_DIR / "data/corpus/openmath_rag_records_expanded.summary.json"


CHAPTERS_479: dict[str, tuple[str, int | None, str]] = {
    "1010": ("도형의 이동", 1, "고등수학(상/하)"),
    "1011": ("다항식의 연산", 1, "고등수학(상)"),
    "1012": ("나머지정리", 1, "고등수학(상)"),
    "1013": ("인수분해", 1, "고등수학(상)"),
    "1014": ("복소수와 이차방정식", 1, "고등수학(상)"),
    "1015": ("이차방정식과 이차함수", 1, "고등수학(상)"),
    "1016": ("여러가지 방정식과 부등식", 1, "고등수학(상)"),
    "1017": ("평면좌표", 1, "고등수학(상)"),
    "1018": ("직선의 방정식", 1, "고등수학(상)"),
    "1019": ("원의 방정식", 1, "고등수학(상)"),
    "1021": ("집합", 1, "고등수학(하)"),
    "1022": ("명제", 1, "고등수학(하)"),
    "1023": ("함수", 1, "고등수학(하)"),
    "1024": ("유리함수와 무리함수", 1, "고등수학(하)"),
    "1025": ("경우의 수", 1, "고등수학(하)"),
    "1026": ("순열과 조합", 1, "고등수학(하)"),
    "1111": ("지수와 로그", 2, "수학Ⅰ"),
    "1112": ("지수함수와 로그함수", 2, "수학Ⅰ"),
    "1113": ("삼각함수", 2, "수학Ⅰ"),
    "1114": ("등차수열과 등비수열", 2, "수학Ⅰ"),
    "1115": ("수열의 합", 2, "수학Ⅰ"),
    "1116": ("수학적 귀납법", 2, "수학Ⅰ"),
    "1121": ("함수의 극한", 2, "수학Ⅱ"),
    "1122": ("함수의 연속", 2, "수학Ⅱ"),
    "1123": ("미분계수", 2, "수학Ⅱ"),
    "1124": ("도함수", 2, "수학Ⅱ"),
    "1125": ("도함수의 활용", 2, "수학Ⅱ"),
    "1126": ("부정적분", 2, "수학Ⅱ"),
    "1127": ("정적분", 2, "수학Ⅱ"),
    "1128": ("정적분의 활용", 2, "수학Ⅱ"),
    "1211": ("수열의 극한", 3, "미적분"),
    "1212": ("급수", 3, "미적분"),
    "1213": ("여러 가지 함수의 미분", 3, "미적분"),
    "1214": ("여러 가지 미분법", 3, "미적분"),
    "1215": ("도함수의 활용", 3, "미적분"),
    "1216": ("여러 가지 적분법", 3, "미적분"),
    "1217": ("정적분의 활용", 3, "미적분"),
    "1221": ("순열과 조합, 이항정리", 3, "확률과 통계"),
    "1222": ("확률의 뜻과 적용", 3, "확률과 통계"),
    "1223": ("조건부확률", 3, "확률과 통계"),
    "1224": ("확률분포", 3, "확률과 통계"),
    "1225": ("통계적 추정", 3, "확률과 통계"),
    "1231": ("이차곡선", 3, "기하"),
    "1232": ("벡터의 연산", 3, "기하"),
    "1233": ("평면벡터의 성분과 내적", 3, "기하"),
    "1234": ("직선과 평면, 정사영", 3, "기하"),
    "1235": ("공간좌표", 3, "기하"),
    }


OPENMATH_TOPICS: dict[str, tuple[str, str, int | None, str]] = {
    "9수01-01": ("middle", "소인수분해", 1, "수와 연산"),
    "9수01-02": ("middle", "정수와 유리수", 1, "수와 연산"),
    "9수01-03": ("middle", "유리수의 사칙연산", 1, "수와 연산"),
    "9수02-01": ("middle", "문자의 사용과 식의 값", 1, "문자와 식"),
    "9수02-02": ("middle", "일차식의 계산", 1, "문자와 식"),
    "9수02-03": ("middle", "일차방정식", 1, "문자와 식"),
    "9수02-04": ("middle", "일차방정식의 활용", 1, "문자와 식"),
    "9수03-01": ("middle", "함수의 개념", 1, "함수"),
    "9수04-01": ("middle", "기본 도형과 작도", 1, "기하"),
    "9수05-01": ("middle", "자료의 정리와 해석", 1, "확률과 통계"),
    "9수01-04": ("middle", "유리수와 순환소수", 2, "수와 연산"),
    "9수02-05": ("middle", "식의 계산", 2, "문자와 식"),
    "9수02-06": ("middle", "일차부등식", 2, "문자와 식"),
    "9수02-07": ("middle", "연립일차방정식", 2, "문자와 식"),
    "9수03-02": ("middle", "일차함수와 그래프", 2, "함수"),
    "9수03-03": ("middle", "일차함수의 활용", 2, "함수"),
    "9수04-02": ("middle", "삼각형의 성질", 2, "기하"),
    "9수04-03": ("middle", "사각형의 성질", 2, "기하"),
    "9수04-04": ("middle", "도형의 닮음", 2, "기하"),
    "9수05-02": ("middle", "경우의 수와 확률", 2, "확률과 통계"),
    "9수01-05": ("middle", "제곱근과 실수", 3, "수와 연산"),
    "9수01-06": ("middle", "근호를 포함한 식의 계산", 3, "수와 연산"),
    "9수02-08": ("middle", "다항식의 곱셈과 인수분해", 3, "문자와 식"),
    "9수02-09": ("middle", "이차방정식", 3, "문자와 식"),
    "9수02-10": ("middle", "이차방정식의 활용", 3, "문자와 식"),
    "9수03-04": ("middle", "이차함수와 그래프", 3, "함수"),
    "9수04-05": ("middle", "삼각비", 3, "기하"),
    "9수04-06": ("middle", "원과 직선의 위치 관계", 3, "기하"),
    "9수04-07": ("middle", "원주각", 3, "기하"),
    "9수05-03": ("middle", "대푯값과 산포도", 3, "확률과 통계"),
    "10공수01-01": ("high", "다항식의 연산", None, "공통수학"),
    "10공수01-02": ("high", "나머지정리", None, "공통수학"),
    "10공수01-03": ("high", "인수분해", None, "공통수학"),
    "10공수01-04": ("high", "복소수와 이차방정식", None, "공통수학"),
    "10공수01-05": ("high", "이차방정식과 이차함수", None, "공통수학"),
    "10공수02-01": ("high", "직선의 방정식", None, "공통수학"),
    "10공수02-02": ("high", "원의 방정식", None, "공통수학"),
    "10공수03-01": ("high", "집합", None, "공통수학"),
    "10공수03-02": ("high", "명제", None, "공통수학"),
    "10공수04-01": ("high", "함수", None, "공통수학"),
    "10공수04-02": ("high", "유리함수와 무리함수", None, "공통수학"),
    "10공수05-01": ("high", "경우의 수", None, "공통수학"),
    "10공수05-02": ("high", "순열과 조합", None, "공통수학"),
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--problem-dataset", type=Path, default=DEFAULT_PROBLEM_DATASET)
    parser.add_argument("--ocr-dataset", type=Path, default=DEFAULT_OCR_DATASET)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--ocr-output", type=Path, default=DEFAULT_OCR_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--skip-ocr", action="store_true", help="Do not rebuild the separate AI Hub 479 OCR corpus.")
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    problem_summary = build_problem_corpus(args.problem_dataset, args.output)
    ocr_summary = None if args.skip_ocr else build_ocr_corpus(args.ocr_dataset, args.ocr_output)
    report = {"problem_corpus": problem_summary, "ocr_corpus": ocr_summary}
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "ocr_output": str(args.ocr_output), "report": str(args.report), **report}, ensure_ascii=False, indent=2))


def build_problem_corpus(dataset_dir: Path, output: Path) -> dict[str, Any]:
    metadata_path = dataset_dir / "problem_metadata_image.jsonl"
    retrieval_path = dataset_dir / "manifests/retrieval_index.jsonl"
    if not metadata_path.exists() or not retrieval_path.exists():
        raise FileNotFoundError(f"Missing cleaned problem dataset files under {dataset_dir}")

    retrieval_by_id = load_retrieval_index(retrieval_path)
    summary: dict[str, Any] = {"records": 0, "by_level": Counter(), "by_grade_label": Counter(), "by_dataset": Counter(), "by_topic": Counter()}
    with metadata_path.open(encoding="utf-8") as source, output.open("w", encoding="utf-8") as sink:
        for line in source:
            raw = json.loads(line)
            record = to_openmath_problem_record(raw, retrieval_by_id.get(raw["problem_id"]))
            sink.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
            summary["records"] += 1
            summary["by_level"][record["curriculum"]["school_level"]] += 1
            summary["by_grade_label"][grade_label(record)] += 1
            summary["by_dataset"][record["id"]["source_dataset"]] += 1
            summary["by_topic"][f'{record["curriculum"].get("topic_code")} {record["curriculum"]["topic_name"]}'] += 1
    return counter_summary(summary)


def load_retrieval_index(path: Path) -> dict[str, dict[str, Any]]:
    rows = {}
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            row = json.loads(line)
            rows[row["problem_id"]] = row
    return rows


def to_openmath_problem_record(raw: dict[str, Any], retrieval: dict[str, Any] | None) -> dict[str, Any]:
    source = raw["source"]
    problem = raw["problem"]
    anchor = raw.get("metadata", {}).get("concept_anchor", {})
    filters = retrieval.get("filters", {}) if retrieval else {}
    paths = retrieval.get("paths", {}) if retrieval else {}
    generation_hints = retrieval.get("generation_hints", {}) if retrieval else {}
    school_level = anchor.get("school_level") or infer_school_level(problem.get("grade_label"))
    grade = anchor.get("grade")
    if grade is None:
        grade = infer_grade(problem.get("grade_label"))
    raw_topic_code = problem.get("achievement_standard") or problem.get("topic_code") or anchor.get("topic_code")
    raw_topic_name = problem.get("topic_name") or anchor.get("topic_name") or "수학"
    normalized_topic = normalize_openmath_topic(raw_topic_code, raw_topic_name, school_level)
    topic_code = normalized_topic[0] if normalized_topic else raw_topic_code
    topic_name = normalized_topic[1] if normalized_topic else raw_topic_name
    if normalized_topic and normalized_topic[2] is not None:
        grade = normalized_topic[2]
    question = problem.get("question_text") or ""
    answer = problem.get("answer_text") or ""
    explanation = problem.get("explanation_text")
    retrieval_text = retrieval.get("retrieval_text") if retrieval else None
    embedding_text = retrieval.get("embedding_text") if retrieval else None
    if not retrieval_text:
        retrieval_text = "\n".join(part for part in [f"학년: {problem.get('grade_label')}", f"단원: {topic_name}", f"문항형식: {problem.get('problem_type')}", f"난이도: {problem.get('difficulty')}", f"문제: {question}", f"정답: {answer}", f"해설: {explanation or ''}"] if part)
    if not embedding_text:
        embedding_text = "\n".join(part for part in [topic_name, question, answer, explanation or ""] if part)

    return {
        "schema_version": "openmath-rag-record-v1",
        "id": {
            "problem_id": f"real-{source['dataset_id']}-{source['split']}-{source.get('item_id', raw['problem_id'])}",
            "source_dataset": str(source["dataset_id"]),
            "split": source["split"],
            "item_id": source.get("item_id"),
            "source_label_type": source.get("source_label_type", "problem_label"),
        },
        "curriculum": {
            "school_level": school_level,
            "grade": grade,
            "semester": None,
            "topic_code": topic_code,
            "topic_name": topic_name,
            "achievement_standard": problem.get("achievement_standard"),
            "achievement_confidence": 0.95 if problem.get("achievement_standard") else 0.6,
            "course": normalized_topic[3] if normalized_topic else None,
        },
        "problem": {
            "question_text": question,
            "choice_blocks": problem.get("choice_blocks") or None,
            "answer_text": answer,
            "explanation_text": explanation,
            "problem_type": normalize_problem_type(problem.get("problem_type")),
            "difficulty": normalize_difficulty(problem.get("difficulty")),
        },
        "taxonomy": {
            "primary_type_id": filters.get("primary_type_id"),
            "type_ids": filters.get("type_ids", []),
            "primary_subtype_id": filters.get("primary_subtype_id"),
            "subtype_ids": filters.get("subtype_ids", []),
        },
        "rag": {"retrieval_text": retrieval_text, "embedding_text": embedding_text},
        "media": {"question_image_relpath": paths.get("problem_image"), "answer_image_relpath": paths.get("answer_image")},
        "quality": {"is_usable": bool(question and answer), "source": "local-cleaned-aihub-problem-dataset", "generation_hints": generation_hints},
        "source_trace": {"original_question_json_relpath": paths.get("record_json"), "original_answer_json_relpath": paths.get("record_json")},
}


def normalize_openmath_topic(raw_code: Any, raw_name: Any, school_level: str) -> tuple[str, str, int | None, str] | None:
    source = clean_text(f"{raw_code or ''} {raw_name or ''}")
    bracket_code = re.search(r"\[(9수|10수학)(\d{2})-(\d{2})\]", source)
    if bracket_code:
        prefix = "10공수" if bracket_code.group(1) == "10수학" else bracket_code.group(1)
        code = f"{prefix}{bracket_code.group(2)}-{bracket_code.group(3)}"
        topic = OPENMATH_TOPICS.get(code)
        if topic:
            return code, topic[1], topic[2], topic[3]

    if school_level == "middle" and any(token in source for token in ["대푯값", "산포도", "평균", "중앙값", "최빈값", "분산", "표준편차"]):
        topic = OPENMATH_TOPICS["9수05-03"]
        return "9수05-03", topic[1], topic[2], topic[3]

    candidates = [
        (code, topic)
        for code, topic in OPENMATH_TOPICS.items()
        if topic[0] == school_level and topic[1] in source
    ]
    if not candidates:
        candidates = [
            (code, topic)
            for code, topic in OPENMATH_TOPICS.items()
            if topic[0] == school_level and topic_name_overlaps(topic[1], source)
        ]
    if not candidates:
        return None
    code, topic = max(candidates, key=lambda item: len(item[1][1]))
    return code, topic[1], topic[2], topic[3]


def topic_name_overlaps(topic_name: str, source: str) -> bool:
    tokens = [token for token in re.split(r"[^0-9A-Za-z가-힣]+", topic_name) if len(token) >= 2]
    if not tokens:
        return False
    return sum(1 for token in tokens if token in source) >= max(1, min(2, len(tokens)))


def build_ocr_corpus(dataset_dir: Path, output: Path) -> dict[str, Any]:
    label_zips = sorted(dataset_dir.rglob("*라벨링데이터/*.zip"))
    if not label_zips:
        raise FileNotFoundError(f"No AI Hub 479 label zip files under {dataset_dir}")
    summary: dict[str, Any] = {"records": 0, "by_grade": Counter(), "by_course": Counter(), "by_chapter": Counter()}
    with output.open("w", encoding="utf-8") as sink:
        for zip_path in label_zips:
            split = "validation" if "Validation" in str(zip_path) or zip_path.name.startswith("VL_") else "train"
            with zipfile.ZipFile(zip_path) as archive:
                for name in archive.namelist():
                    if not name.endswith(".json"):
                        continue
                    raw = json.loads(archive.read(name).decode("utf-8"))
                    record = to_openmath_ocr_record(raw, split, name, zip_path)
                    if record is None:
                        continue
                    sink.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
                    summary["records"] += 1
                    summary["by_grade"][str(record["curriculum"]["grade"])] += 1
                    summary["by_course"][record["curriculum"]["course"]] += 1
                    summary["by_chapter"][f'{record["curriculum"]["topic_code"]} {record["curriculum"]["topic_name"]}'] += 1
    return counter_summary(summary)


def to_openmath_ocr_record(raw: dict[str, Any], split: str, entry_name: str, zip_path: Path) -> dict[str, Any] | None:
    chapter_id = str(raw.get("chapter_id", ""))
    chapter = CHAPTERS_479.get(chapter_id)
    if not chapter:
        return None
    topic_name, grade, course = chapter
    segments = raw.get("segments", [])
    equations = [clean_text(seg.get("equation", "")) for seg in segments if clean_text(seg.get("equation", ""))]
    if not equations:
        return None
    segment_text = " ".join(equations)
    item_id = Path(entry_name).stem
    topic_code = f"AIHUB479-{chapter_id}"
    retrieval_text = f"학년: 고등학교 {grade}학년\n과목: {course}\n단원: {topic_name}\n자료유형: OCR 수식/텍스트 라벨\n내용: {segment_text}"
    return {
        "schema_version": "openmath-rag-record-v1",
        "id": {
            "problem_id": f"ocr-479-{split}-{item_id}",
            "source_dataset": "30",
            "split": split,
            "item_id": item_id,
            "source_label_type": "ocr_label_479",
        },
        "curriculum": {
            "school_level": "high",
            "grade": grade,
            "semester": None,
            "topic_code": topic_code,
            "topic_name": topic_name,
            "achievement_standard": topic_code,
            "achievement_confidence": 0.4,
            "course": course,
            "chapter_id_479": chapter_id,
        },
        "problem": {
            "question_text": segment_text,
            "choice_blocks": None,
            "answer_text": "OCR_LABEL_ONLY",
            "explanation_text": None,
            "problem_type": "subjective",
            "difficulty": "medium",
        },
        "taxonomy": {"primary_type_id": "OPT_FORMULA_SYMBOLIC", "type_ids": ["OPT_FORMULA_SYMBOLIC"], "primary_subtype_id": "OPS_SYMBOLIC_EXPRESSION_PROMPT", "subtype_ids": ["OPS_SYMBOLIC_EXPRESSION_PROMPT"]},
        "rag": {"retrieval_text": retrieval_text, "embedding_text": f"{course}\n{topic_name}\n{segment_text}"},
        "media": {"question_image_relpath": image_relpath_for_ocr(entry_name), "answer_image_relpath": None},
        "quality": {"is_usable": True, "source": "aihub-479-high-ocr", "zip": str(zip_path)},
        "source_trace": {"original_question_json_relpath": entry_name, "original_answer_json_relpath": None},
    }


def image_relpath_for_ocr(entry_name: str) -> str:
    return re.sub(r"\.json$", ".png", entry_name)


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value)).strip()


def infer_school_level(grade_label: Any) -> str:
    return "high" if "고등" in str(grade_label) else "middle"


def infer_grade(grade_label: Any) -> int | None:
    match = re.search(r"([123])학년", str(grade_label))
    return int(match.group(1)) if match else None


def normalize_problem_type(value: Any) -> str:
    value = str(value or "subjective")
    return value if value in {"objective", "essay", "short_answer", "subjective"} else "subjective"


def normalize_difficulty(value: Any) -> str:
    value = str(value or "medium")
    return value if value in {"easy", "medium", "hard"} else "medium"


def grade_label(record: dict[str, Any]) -> str:
    level = record["curriculum"]["school_level"]
    grade = record["curriculum"].get("grade")
    if level == "high" and grade is None:
        return "고등학교 공통수학"
    return f"{'고등학교' if level == 'high' else '중학교'} {grade}학년"


def counter_summary(summary: dict[str, Any]) -> dict[str, Any]:
    return {key: (value.most_common() if isinstance(value, Counter) else value) for key, value in summary.items()}


if __name__ == "__main__":
    main()
