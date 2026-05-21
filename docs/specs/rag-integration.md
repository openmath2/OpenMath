# RAG Integration Spec

| | |
|---|---|
| Status | Draft |
| Last updated | 2026-05-21 |
| Depends on | `architecture.md` D-7, `domain.md` §2.1 |

이 문서는 OpenMath `agent`가 외부 AI Hub 기반 RAG 데이터를 어떻게 읽는지 기록한다.
생성 파이프라인, LLM 호출, `/api/generate` wiring은 이 문서 범위가 아니다.

---

## 1. 목적

OpenMath는 `RagClient` 인터페이스로만 RAG 데이터에 접근한다.
현재 구현은 파일 기반 MVP이며, 아래 canonical JSONL 하나를 읽는다.

```text
/Users/tw81512/dev/AI_HUB_data/rag_problem_generation_dataset/openmath_rag_records.jsonl
```

이 파일은 AI Hub 30 / 110 / 111 데이터를 `openmath-rag-record-v1` 형태로 통합한 결과물이다.

---

## 2. Runtime Dependency

OpenMath 런타임이 직접 참조하는 RAG 파일은 하나다.

```text
openmath_rag_records.jsonl
```

`.env.example`에는 다음 경로 예시를 둔다.

```env
CORPUS_JSONL=/Users/tw81512/dev/AI_HUB_data/rag_problem_generation_dataset/openmath_rag_records.jsonl
```

현재 `createInMemoryRagClient`는 `jsonlPath` 옵션으로 이 파일을 받는다.
`CORPUS_JSONL`을 실제 wiring에 주입하는 작업은 추후 `src/index.ts` / workflow wiring 범위다.

### 2.1 파일 위치가 바뀌는 경우

RAG 데이터를 새로 받거나 다른 위치에 둘 때는 OpenMath 코드를 수정하지 않고
실행 환경의 `CORPUS_JSONL`만 바꾼다.

예:

```env
CORPUS_JSONL=/absolute/path/to/rag_problem_generation_dataset/openmath_rag_records.jsonl
```

권장 절차:

1. 외부에서 받은 RAG 데이터 폴더 안에 `openmath_rag_records.jsonl`이 있는지 확인한다.
2. `packages/agent/.env`를 만들거나 실행 환경변수에 `CORPUS_JSONL`을 설정한다.
3. 값은 디렉토리가 아니라 JSONL 파일명까지 포함한 절대경로로 둔다.
4. `pnpm -F @openmath/agent test`로 RAG client 단위 테스트를 확인한다.

예시 로컬 `.env`:

```env
PORT=3000
MATH_ENGINE_URL=http://localhost:8000
CORPUS_JSONL=/Users/<name>/dev/AI_HUB_data/rag_problem_generation_dataset/openmath_rag_records.jsonl
```

주의:

- `CORPUS_JSONL`은 `openmath-rag-record-v1` 형식의 JSONL이어야 한다.
- `problem_metadata_image.jsonl`이나 `manifests/retrieval_index.jsonl`을 직접 지정하면 현재 `RagClient`와 맞지 않는다.
- 데이터 폴더 전체를 OpenMath 레포 안에 복사할 필요는 없다.
- 경로가 바뀌어도 바꿀 곳은 코드가 아니라 `CORPUS_JSONL`이다.

---

## 3. Non-runtime Files

다음 파일들은 현재 OpenMath `agent` 런타임이 직접 읽지 않는다.

```text
problem_metadata_image.jsonl
manifests/retrieval_index.jsonl
manifests/achievement_standards.jsonl
manifests/achievement_standards_2022.jsonl
manifests/problem_achievement_mapping.jsonl
manifests/problem_achievement_mapping_2022.jsonl
manifests/problem_image_metadata_mapping.jsonl
manifests/problem_image_metadata_mapping.csv
summary.json
README.md
rag_lookup.py
openmath_rag_lookup.py
build_openmath_rag_records.py
build_achievement_metadata.py
build_2022_achievement_metadata.py
activate_2022_curriculum.py
source_docs/*
```

역할 구분:

| 용도 | 파일 |
|---|---|
| OpenMath 실행 | `openmath_rag_records.jsonl` |
| canonical 데이터 재생성 | `problem_metadata_image.jsonl`, `manifests/retrieval_index.jsonl`, build scripts, achievement manifests, `source_docs/*` |
| 수동 점검 / Python 검색 | `rag_lookup.py`, `openmath_rag_lookup.py`, `summary.json`, `README.md` |
| 이미지 / 원본 추적 보조 | `manifests/problem_image_metadata_mapping.*` |

---

## 4. Canonical Record Contract

`openmath_rag_records.jsonl`의 각 줄은 `openmath-rag-record-v1` JSON 객체다.
현재 확인한 top-level shape:

```text
schema_version
id
curriculum
problem
taxonomy
rag
media
quality
source_trace
```

OpenMath는 이 중 `id`, `curriculum`, `problem`, `taxonomy`, `rag`, `media`, `quality`, `source_trace`를 읽어
`SourceProblem` 및 검색 점수 산정용 내부 인덱스로 변환한다.

현재 active curriculum은 2022 개정이다.

```text
curriculum.active_curriculum = "2022 개정"
curriculum.curriculum = "2022 개정"
curriculum.curriculum_source = "official_2022_math_curriculum"
```

2015 매핑은 `curriculum.achievement_2015`에 병렬 보존된다.
2022 매핑은 flat `achievement_*` 필드와 `curriculum.achievement_2022`에 있다.

---

## 5. Mapping to SourceProblem

`createInMemoryRagClient`는 canonical record를 기존 `SourceProblem`으로 flatten한다.

| SourceProblem | openmath-rag-record-v1 |
|---|---|
| `item_id` | `id.problem_id` |
| `source_dataset` | `id.source_dataset` |
| `split` | `id.split` |
| `source_label_type` | `id.source_label_type` |
| `school_level` | `curriculum.school_level` |
| `grade` | `curriculum.grade` |
| `semester` | `curriculum.semester` |
| `topic_code` | `curriculum.topic_code` |
| `topic_name` | `curriculum.topic_name` |
| `achievement_standard` | `curriculum.achievement_standard` |
| `question_text` | `problem.question_text` |
| `answer_text` | `problem.answer_text` |
| `explanation_text` | `problem.explanation_text` |
| `choice_blocks` | `problem.choice_blocks` |
| `problem_type_norm` | `problem.problem_type` |
| `difficulty_norm` | `problem.difficulty` |
| `question_image_relpath` | `media.question_image_relpath` |
| `answer_image_relpath` | `media.answer_image_relpath` |
| `question_json_relpath` | `source_trace.original_question_json_relpath` |
| `answer_json_relpath` | `source_trace.original_answer_json_relpath` |

`taxonomy`와 `rag.retrieval_text` / `rag.embedding_text`는 `SourceProblem`에 넣지 않고,
검색 점수 산정용 내부 인덱스에 보존한다.

---

## 6. Implemented Code

구현 위치:

```text
packages/agent/src/tools/rag-client.ts
```

추가된 동작:

- JSONL line-by-line 로드
- `quality.is_usable === false` 레코드 제외
- canonical record를 `SourceProblem`으로 변환
- `school_level`, `grade`, `topic_code`, `topic_name`, `problem_type`, `difficulty` 필터 지원
- `minAchievementConfidence` 옵션 지원
- topic / intent / retrieval text 기반 간단한 token overlap 점수 산정
- `RagResult` 반환

추가된 테스트:

```text
packages/agent/tests/rag-client.test.ts
```

검증 내용:

- canonical JSONL fixture를 읽고 `SourceProblem`으로 변환하는지
- 중학교 / 학년 / 단원명 / 유형 / 난이도 검색이 동작하는지
- `minAchievementConfidence`로 저신뢰 성취기준 매핑을 제외할 수 있는지

---

## 7. Search Policy

현재 필터 정책:

| Query | 동작 |
|---|---|
| `school_level` | 정확히 일치해야 함 |
| `grade` | query가 `null`이 아니면 정확히 일치해야 함 |
| `topic_code` | 제공되면 정확히 일치해야 함 |
| `topic_name` | normalized substring 또는 token overlap이 있어야 함 |
| `problem_type` | 제공되면 정확히 일치해야 함 |
| `difficulty` | 제공되면 정확히 일치해야 함 |
| `minAchievementConfidence` | record confidence가 이 값보다 낮으면 제외 |

점수는 deterministic lexical score다. 아직 vector DB나 embedding search는 없다.

---

## 8. Verification

확인한 명령:

```bash
pnpm -F @openmath/agent typecheck
pnpm -F @openmath/agent test
pnpm -F @openmath/agent build
```

결과:

```text
typecheck OK
agent tests OK, 7 passed
agent build OK
```

실제 데이터 스모크 테스트도 수행했다.

쿼리:

```ts
{
  school_level: "middle",
  grade: 2,
  topic_name: "닮은 도형 넓이",
  problem_type: "objective",
  k: 3
}
```

확인된 결과 예:

```text
111:train:00041_36224
topic: SAS닮음을 이용하여 변의 길이 구하기
standard: 삼각형의 닮음 조건을 이해하고, 이를 이용하여 두 삼각형이 닮음인지 판별할 수 있다.
type: objective
```

---

## 9. Remaining Work

이 문서 범위 밖이지만 다음 단계에서 필요하다.

1. `src/index.ts` 또는 workflow dependency wiring에서 `CORPUS_JSONL`로 `createInMemoryRagClient` 생성
2. `steps/rag-search.ts`에서 `RagClient.search` 호출
3. `RagResult`에 taxonomy / generation hints를 노출할지 결정
4. 검색 품질을 높이려면 vector index 또는 `retrieval_index.jsonl` 기반 별도 backend 도입 검토

현재 완료된 것은 “OpenMath가 canonical RAG JSONL을 읽고 검색할 수 있는 연결부”다.
