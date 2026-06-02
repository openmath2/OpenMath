# Data

`packages/agent/data/` — RAG corpus + 출제전략.

[비할당] 담당이 만지는 영역. agent 코드는 `RagClient` / `StrategyLoader` 인터페이스로만 접근하므로
이 디렉토리 안의 *형식*을 자유롭게 진화시킬 수 있다 (architecture.md D-7).

## 구조

```
data/
├── corpus/
│   └── openmath_rag_records.jsonl     # 로컬/서버에만 배치하는 본 corpus
└── achievement-standards/
    ├── 9수01-01.yaml                  # 소인수분해
    ├── 9수01-05.yaml                  # 제곱근과 실수
    ├── 9수02-01.yaml                  # 문자의 사용과 식의 값
    ├── 9수02-03.yaml                  # 일차방정식
    ├── 9수02-06.yaml                  # 일차부등식
    ├── 9수02-07.yaml                  # 연립일차방정식
    ├── 9수02-08.yaml                  # 다항식의 곱셈과 인수분해
    ├── 9수02-09.yaml                  # 이차방정식
    ├── 9수02-10.yaml                  # 이차방정식의 활용
    ├── 9수03-02.yaml                  # 일차함수와 그래프
    ├── 9수03-04.yaml                  # 이차함수와 그래프
    └── 9수04-05.yaml                  # 삼각비
```

## Corpus

런타임 corpus는 `openmath-rag-record-v1` JSONL이다. 기본 로컬 경로:

```text
/Users/tw81512/dev/AI_HUB_data/rag_problem_generation_dataset/openmath_rag_records.jsonl
```

권장 실행 방식은 corpus를 repo에 커밋하지 않고 `.env`에 절대 경로를 지정하는 것이다.

```env
CORPUS_JSONL=/absolute/path/to/openmath_rag_records.jsonl
```

본 corpus는 크기가 커서 `.gitignore`에서 제외한다. 작은 fixture가 필요하면 파일명에
`fixture`를 포함한 JSONL만 커밋한다.

후속 swap (Postgres / Cube / pgvector)은 인터페이스 안정 후 결정 — Q-2 partial closure.

## 출제 전략 (Strategy YAML)

`docs/specs/domain.md` §2.5 + `src/schemas/strategy.schema.ts` 의 `StrategySchema` 스키마 따른다.

파일명은 성취기준 코드와 1:1 (`9수04-12.yaml`).

최소 템플릿:

```yaml
code: 9수02-09
title: 이차방정식
school_level: middle
grade: 3
techniques:
  required_at_least_one_of:
    - factoring
  forbidden: []
evaluation_dimensions:
  - id: A
    description: 이차식을 인수분해한다.
    must_preserve: true
difficulty_range:
  - easy
  - medium
problem_types_supported:
  - objective
structural_transforms:
  - kind: coefficient_swap
    range: [-10, 10]
    exclude_zero: true
conceptual_transforms:
  - kind: present_via_root_relations
```

새 단원 추가 워크플로:

1. `achievement-standards/<code>.yaml` 파일을 만든다.
2. `code`, `title`, `school_level`, `grade`를 성취기준과 맞춘다.
3. `evaluation_dimensions`에는 `must_preserve: true` 항목을 최소 1개 둔다.
4. `problem_types_supported`와 `difficulty_range`를 시연 범위에 맞춘다.
5. `pnpm -F @openmath/agent test`로 YAML loader와 workflow 회귀를 확인한다.

## 변경 정책

- 새 strategy 추가 시 schema 검증 통과해야 함
- corpus 갱신은 [한진우]가 정규화 스크립트 통과 후 외부 storage/로컬 경로로 배치
- `pnpm -F @openmath/agent test`는 strategy YAML 파싱이 통과되는지 검증

## TODO

- [x] 핵심 단원 12개 strategy YAML 작성
- [ ] 서버 배포 시 `CORPUS_JSONL` 위치 확정
- [ ] Cube/pgvector 도입 결정 (Q-2)
