# AGENTS.md

이 문서는 *코드베이스에서 일할 때* 보는 빠른 참조다.
- `README.md` — 프로젝트가 *무엇* 인가
- `CONTRIBUTING.md` — *어떻게 협업* 하는가 (브랜치·hook·PR)
- `AGENTS.md` (이 문서) — *어디서 무엇을 만지는가*, *무엇을 하지 말아야 하는가*

---

## 1. 황금 규칙

1. **spec이 코드보다 먼저** — `docs/specs/*.md`에 근거 없는 코드는 들어가지 않는다.
2. **결정론적 검증 게이트** — LLM은 *정답 판단*을 하지 않는다 (D-1). SymPy + 학습목표 매칭만 최종 판정.
3. **인터페이스 안정, 구현 자유** — agent 코드가 의존하는 건 인터페이스 (`RagClient`, `MathEngineClient`, `PromptLoader`). 그 뒤 구현은 swap 가능.
4. **`main` 직접 push 금지** — pre-push hook이 차단. `feat/<scope>-<name>` 브랜치 → PR.
5. **`[본인]` vs `[비할당]` 영역 확인** — 무엇을 만져도 되는지 먼저 본다.

---

## 2. spec ↔ 코드 매핑

| spec | 코드 |
|---|---|
| [`docs/specs/architecture.md`](docs/specs/architecture.md) §3 components | `packages/{agent,math-engine,web}/` |
| [`docs/specs/architecture.md`](docs/specs/architecture.md) §7 D-1 (결정론 게이트) | `packages/agent/src/schemas/verification.schema.ts` `assertVerificationInvariants` |
| D-4 (Vercel AI SDK) | `packages/agent/src/tools/llm-provider.ts` |
| D-5 (Specialist 구성) | `packages/agent/src/agents/*`, `packages/agent/src/steps/*` |
| D-6 (SSE) | `packages/agent/src/server/sse/progress-stream.ts`, `packages/agent/src/server/routes/generate.ts` |
| D-7 (RagClient) | `packages/agent/src/tools/rag-client.ts` |
| D-8 (.md frontmatter) | `packages/agent/src/tools/prompt-loader.ts`, `packages/agent/prompts/*.md` |
| D-9 (Next.js 14 + 듀얼-서피스 디자인) | `packages/web/`, `packages/web/DESIGN.md` |
| [`docs/specs/domain.md`](docs/specs/domain.md) §2 도메인 | `packages/agent/src/schemas/*.schema.ts` |
| 불변식 I-V1 ~ I-V5 | `assertVerificationInvariants` |
| 불변식 I-I1 ~ I-I3 | `IntentSchema.regex` + `assertIntentInvariants` |
| 불변식 I-T1 ~ I-T4 | `StrategySchema.regex` + `assertStrategyInvariants` |

---

## 3. 명령 cheatsheet

| 작업 | 명령 |
|---|---|
| 의존성 설치 + git hooks | `pnpm install` |
| 세 서비스 동시 dev | `pnpm dev:all` |
| agent만 dev | `pnpm dev` (`:3000`) |
| math-engine만 dev | `pnpm dev:math` (`:8000`) |
| web만 dev | `pnpm dev:web` (`:3001`) |
| Node typecheck (agent + web) | `pnpm typecheck` |
| Node unit test (agent) | `pnpm -F @openmath/agent test` |
| Node integration test | `pnpm -F @openmath/agent test:integration` |
| Python pytest | `pnpm test:python` |
| Web build | `pnpm -F @openmath/web build` |
| DESIGN.md lint | `npx @google/design.md lint packages/web/DESIGN.md` |
| 전체 테스트 (pre-push) | `pnpm test` |

`pnpm test` = Node + Python. integration / web build 는 별도. PR 전엔 모두 확인 권장.

---

## 4. 결정 요약 ([architecture.md §7](docs/specs/architecture.md) 참조)

| ID | 결정 | 한 줄 |
|---|---|---|
| D-1 | 생성·검증 분리 | LLM 생성, SymPy 검증 |
| D-2 | Node + Python 두 서비스 | HTTP/JSON |
| D-3 | 1차 사용자 = 학원 강사 | 인증 1차 MVP out |
| D-4 | Vercel AI SDK | `ai` + `@ai-sdk/*` |
| D-5 | (β) 명명 + (ε) Hybrid | Generation 노드만 multi-agent |
| D-6 | SSE 스트리밍 | step bar 라이브 노출 |
| D-7 | `RagClient` 인터페이스 + JSONL MVP | swap 가능 |
| D-8 | 프롬프트 = `.md` + YAML frontmatter | hot-reload |
| D-9 | `packages/web` Next.js 14 + 듀얼-서피스 DESIGN.md | editorial + productivity 한 시스템 |

---

## 5. 도메인 어휘 ([domain.md §2](docs/specs/domain.md))

| 용어 | 의미 |
|---|---|
| **SourceProblem** | 원본 정규화 문제 (`math-sample-unified-v1`, 2,400건) |
| **Intent** | 학습 목표 + 평가 차원 (동형성 판정의 축) |
| **GeneratedProblem** | LLM 생성 후보 (검증 전엔 사용자에게 노출 X — I-G4) |
| **Verification** | 6단계 결과 + `overall ∈ {verified, rejected, warning}` |
| **Strategy** | 성취기준별 출제 룰 (`data/achievement-standards/<code>.yaml`) |
| **Structural isomorphic** | 숫자·표현 변형, 풀이 단계 동일 |
| **Conceptual isomorphic** | 학습 목표·평가 차원 보존, 풀이 경로 다름 |

---

## 6. 토스 단위 (`[비할당]`)

agent 코드를 *건드리지 않고* 동작이 바뀌는 영역.

| 영역 | 위치 | 누가 만지나 |
|---|---|---|
| 프롬프트 | `packages/agent/prompts/*.md` | `[비할당]` |
| 출제 전략 | `packages/agent/data/achievement-standards/*.yaml` | `[비할당]` |
| RAG corpus | `packages/agent/data/corpus/*.jsonl` | `[비할당]` |
| 프론트 디자인 토큰 | `packages/web/DESIGN.md` frontmatter | `[비할당]` (FE 디자이너) |
| 프론트 컴포넌트 | `packages/web/components/**/*.tsx` | `[비할당]` (FE 엔지니어) |
| 프론트 페이지 (S0~S6) | `packages/web/app/**/page.tsx` | `[비할당]` (FE 엔지니어) |

이 영역의 변경은 `prompt-loader` / `strategy-loader` / `rag-client` / `DESIGN.md` 토큰 시스템이 흡수.

---

## 7. 자주 하는 작업

### 새 결정 추가
1. `architecture.md` §7에 D-N 추가 (결정 / 대안 / 채택 사유)
2. 관련 Q-* 있으면 `Closed by D-N` 표시
3. 코드 변경 *같은 PR*로 묶음

### 새 도메인 필드 추가
1. `domain.md` §2 갱신
2. `packages/agent/src/schemas/*.schema.ts` Zod schema 갱신
3. 새 불변식이면 `assertXxxInvariants` 추가
4. `tests/placeholder.test.ts`에 invariant 테스트 추가

### 프롬프트 변경 (`[비할당]`이 매일 함)
1. `prompts/<id>.md` frontmatter `version` 올림 (semver)
2. body 수정
3. commit. **agent 코드 변경 없음**

### 새 step 또는 specialist 추가
1. `architecture.md` D-5 갱신 (Specialist 구성 변경)
2. `packages/agent/src/steps/<name>.ts` 또는 `agents/<name>-agent.ts` 추가
3. `workflows/verification-workflow.ts` orchestrator에 step 삽입
4. `schemas/verification.schema.ts`의 `StepName` enum 확장
5. invariant I-V1 (gates.length=6) 영향 시 도메인 spec 먼저 갱신

---

## 8. 절대 하지 말 것

| 금지 | 이유 |
|---|---|
| LLM에게 정답 판단 시키기 | D-1 위반. 검증 게이트는 결정론 (SymPy + objective_map) |
| 멀티에이전트 debate를 검증 게이트로 사용 | D-5 (ε): debate는 합의 ≠ 정답 |
| 검증 안 된 `GeneratedProblem`을 사용자에게 노출 | I-G4 |
| `as any` / `@ts-ignore` / `@ts-expect-error` | `CONTRIBUTING.md` 코드 스타일 |
| 빈 `catch(e) {}` | 실패 은닉 |
| `--no-verify`로 hook 우회 | `CONTRIBUTING.md` — 예외 상황 외 금지 |
| `main` 직접 push | pre-push hook + GitHub branch protection |
| 실패하는 테스트를 *지워서* 녹색으로 만들기 | 회귀 무방비 |

---

## 9. 진입점 우선순위 (현재 미구현)

`grep -rn "not implemented yet" packages/agent/src` 로 14곳 확인 가능.

| Priority | 파일 | 비고 |
|---|---|---|
| P0 | `tools/math-engine-client.ts` `createMathEngineClient` | math-engine은 작동 중. 첫 통합 |
| P0 | `tools/prompt-loader.ts` `createFsPromptLoader` | gray-matter + handlebars |
| P0 | `tools/llm-provider.ts` `resolveLanguageModel` | CLIProxyAPI 우선 |
| P1 | `tools/rag-client.ts` `createInMemoryRagClient` | JSONL + filter |
| P1 | `agents/*-agent.ts` (4개) | `generateObject` + prompt 로드 |
| P1 | `steps/*.ts` (6개) | agents/tools 얇은 wrapper |
| P2 | `workflows/verification-workflow.ts` | async generator + I-V invariant assert |
| P2 | `server/routes/generate.ts` + `sse/progress-stream.ts` | streamSSE 흘리기 |
| P3 | `src/index.ts` `main` | dep wiring (10줄) |

---

## 10. 관련 문서 index

- [`README.md`](README.md) — 프로젝트 무엇·왜·누구
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — 브랜치·hook·커밋·CI 규칙
- [`docs/specs/architecture.md`](docs/specs/architecture.md) — L0 시스템 경계, 결정 8개, Open Questions 4개
- [`docs/specs/domain.md`](docs/specs/domain.md) — L1 도메인 개념 + 불변식 17개
- [`docs/product/`](docs/product/) — 사용자 측 기획 5종 + HTML preview (2026-05-07 핸드오프)
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — 데이터 파이프라인 + 에이전트 실험 보고 (2026-04-03)
