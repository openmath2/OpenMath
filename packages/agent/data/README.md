# Data

`packages/agent/data/` — RAG corpus + 출제전략.

[비할당] 담당이 만지는 영역. agent 코드는 `RagClient` / `StrategyLoader` 인터페이스로만 접근하므로
이 디렉토리 안의 *형식*을 자유롭게 진화시킬 수 있다 (architecture.md D-7).

## 구조 (계획)

```
data/
├── corpus/
│   └── math-sample-unified-v1.jsonl   # math-sample-unified-v1 스키마 (2,400건)
│                                        # 출처: docs/PROGRESS.md §2.4
└── achievement-standards/
    ├── 9수04-12.yaml                  # 이차방정식의 풀이
    ├── 9수04-13.yaml
    └── ...                            # 성취기준별 1:1 파일 (I-T3)
```

## Corpus

`math-sample-unified-v1.jsonl` — `docs/PROGRESS.md` §2.3 정규화 결과.
1차 MVP는 메모리 인덱스 (`createInMemoryRagClient`)로 로드.

후속 swap (Postgres / Cube / pgvector)은 인터페이스 안정 후 결정 — Q-2 partial closure.

## 출제 전략 (Strategy YAML)

`docs/specs/domain.md` §2.5 + `src/schemas/strategy.schema.ts` 의 `StrategySchema` 스키마 따른다.

파일명은 성취기준 코드와 1:1 (`9수04-12.yaml`).

샘플 → `examples/9수04-12.yaml` 참조 (TODO: 작성).

## 변경 정책

- 새 strategy 추가 시 schema 검증 통과해야 함
- corpus 갱신은 [한진우]가 정규화 스크립트 (`scripts/normalize_sample_jsons.py` 등) 통과 후 commit
- `pnpm test`는 strategy YAML 파싱이 통과되는지 검증 (TODO: test 작성)

## TODO

- [ ] 핵심 단원 12개에 대한 strategy YAML 작성
- [ ] corpus JSONL을 이 디렉토리로 복사 (또는 symlink)
- [ ] strategy YAML 검증 테스트
- [ ] Cube/pgvector 도입 결정 (Q-2)
