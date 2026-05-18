# L0 Architecture Spec

| | |
|---|---|
| Status | Proposed |
| Last updated | 2026-05-18 |
| Supersedes | — |

이 문서는 OpenMath 시스템의 **가장 바깥 경계**를 정의한다.
"무엇을 만드는가, 어떤 컴포넌트가 있는가, 누가 누구와 어떻게 통신하는가."
도메인 개념(Problem, Verification 등)은 이 문서가 아닌 L1에서 다룬다.

---

## 1. Context

### 1.1 무엇을 만드는가
한국 중학교 수학 교육과정(2022 개정)의 **수학적으로 검증된 문제(isomorphic)** 를
생성·검증하는 시스템.

### 1.2 왜 이런 시스템이 필요한가
- LLM 단독은 그럴듯하지만 **수학적으로 틀린** 문제를 만든다 (MathTrap300).
- 따라서 **생성과 검증을 분리**한다. LLM이 만들고, 기호 계산 시스템이 증명한다.

### 1.3 이해관계자
> 누가 이 시스템을 어떤 모드로 사용하는지. 인증/권한 모델의 출발점.

- **1차 사용자**: 학원 수학 강사 (D-3)
- **2차 사용자**: 학교 수학 교사 (자동 충족 — `docs/product/USER_FLOW.md` §6)
- **부수 사용자**: 캡스톤 심사위원 (데모 단계)

1차 MVP는 로그인 없는 단일 사용자 도구. 인증·계정·결제는 v2.

---

## 2. System Boundary

### 2.1 In scope
- 수학 문제 **생성** 파이프라인 (LLM + 도구 사용)
- 수학 문제 **검증** 파이프라인 (SymPy 기반 기호 계산)
- 두 파이프라인을 노출하는 **HTTP API**

### 2.2 Out of scope
- 학생용 프론트엔드 UI
- 학습 분석/대시보드
- 사용자 계정·인증 시스템 (현재 단계)
- 결제·구독

> Out of scope는 영원히 out이 아니라 "이 spec에선 다루지 않는다"는 뜻이다.

---

## 3. Components

현재까지 합의된 컴포넌트만 적는다. 추가가 필요하면 Open Questions로 들어간다.

| 이름 | 스택 | 책임 | 위치 |
|---|---|---|---|
| `agent` | Node.js + Hono + OpenAI Agents SDK | LLM 오케스트레이션, HTTP API 노출, 도구 호출 라우팅 | `packages/agent/` |
| `math-engine` | Python + FastAPI + SymPy | 기호 계산(풀이/동치 검증/단순화/미분/극한)을 HTTP로 제공 | `packages/math-engine/` |
| `llm-provider` | OpenAI 또는 CLIProxyAPI | 추론 모델 제공 (외부 의존) | 외부 |

### 3.1 컴포넌트 책임 경계
- `agent`는 **수학 계산을 직접 하지 않는다.** 모든 기호 계산은 `math-engine` 호출로만.
- `math-engine`은 **LLM을 호출하지 않는다.** 순수 결정론적 계산만.
- `agent`는 **LLM이 만든 결과를 그대로 신뢰하지 않는다.** 항상 검증 단계를 거친다.

### 3.2 데이터 저장소
> RAG 검색, 출제전략 저장 등에 필요한 영속 저장소.

`agent`는 `RagClient` 인터페이스로만 데이터에 접근한다 (D-7). 1차 MVP 구현은 JSONL + 메모리 인덱스. 실제 영속 저장소 (Cube vs Postgres vs pgvector) 선정은 인터페이스 안정 후로 보류 — Q-2 부분 closure.

---

## 4. Communication Topology

### 4.1 합의된 것
- `agent` ↔ `math-engine`: HTTP/JSON, 동기 요청-응답.
- `agent` ↔ `llm-provider`: HTTPS, OpenAI 호환 API.

### 4.2 결정됨·미정
- **클라이언트 ↔ `agent`**: SSE 스트리밍 (Hono `streamSSE` + `EventSource`) — D-6
- **`agent` 내부 멀티 에이전트**: 외부 (β) Orchestrator + 6 Specialists 명명 + 내부 (ε) Hybrid (Generation 노드만 Generator/Critic/Refiner multi-agent, 나머지는 결정론 또는 단일 LLM) — D-5
- **서비스 디스커버리**: 환경변수 `MATH_ENGINE_URL` 하드코딩 유지 (1차 MVP scope)

---

## 5. Trust & Failure

### 5.1 신뢰 경계
> "어디까지가 우리 코드이고, 어디부터가 외부인가."
- [ ] 정의 필요 (Open Question 4 참조)

### 5.2 실패 모드 (식별만, 처리 정책은 미정)
- LLM provider 다운/지연/rate limit
- LLM 출력이 기대 형식이 아님 (JSON 파싱 실패 등)
- `math-engine` 다운 또는 타임아웃
- `math-engine`의 SymPy parse 실패
- 검증이 모순을 발견 (생성-검증 루프를 어디까지 돌릴 것인가)

### 5.3 비용 경계
> LLM 호출은 돈이다. 무한 루프나 폭주를 막을 상한이 필요.
- [ ] 정의 필요 (Open Question 5 참조)

---

## 6. Non-functional Targets

> 모두 미정. 캡스톤 데모/배포 형태가 정해진 후 채운다.

| 항목 | 목표 | 근거 |
|---|---|---|
| 단일 문제 생성 latency (p95) | TBD | |
| 동시 사용자 수 | TBD | |
| LLM 비용 상한 (월) | TBD | |
| 가용성 | TBD | |
| 관측성 (logging/tracing) | TBD | |

---

## 7. Key Decisions

> 채택된 결정만 적는다. 각 항목에는 대안과 채택 사유가 함께 있어야 한다.

### D-1. 생성과 검증의 분리
- **결정**: LLM은 생성만, SymPy는 검증만 담당한다. 한 모델이 둘 다 하지 않는다.
- **대안**: (a) LLM 단독 self-check, (b) LLM × LLM 상호 검증, (c) 본 결정.
- **채택 사유**: (a)(b) 모두 [MathTrap300] 등에서 신뢰성 부족이 보고됨.
  결정론적 검증 경로를 통해서만 "수학적으로 옳다"를 보장할 수 있다.

### D-2. 두 서비스를 별 프로세스로 분리
- **결정**: `agent`(Node)와 `math-engine`(Python)을 별 HTTP 서비스로 분리한다.
- **대안**: (a) child_process 호출, (b) Python 임베딩, (c) 본 결정.
- **채택 사유**: SymPy는 Python 외에 대체가 없고, Node 측 LLM 도구 생태계는
  Python 임베딩보다 별 서비스가 더 단순하다. 배포·테스트 분리 이득.

### D-3. 1차 사용자는 학원 수학 강사
- **결정**: 1차=학원 강사, 2차=학교 교사. 인증·계정은 1차 MVP out.
- **대안**: (a) 학교 교사 우선, (b) 학생 자가학습용, (c) 출판사 API 고객, (d) 캡스톤 심사용 데모만.
- **채택 사유**: 사용 빈도 압도적 (강사 주 1~2회 vs 교사 분기 2회). Pain 첨예 (카톡방 답 유출, 매주 출제 압박). 매스플랫·콴다 매출 데이터로 학원 시장 검증. 강사 흐름이 충족되면 교사 흐름은 90% 자동 충족 (`docs/product/USER_FLOW.md` §6).
- **Closes**: Q-1

### D-4. LLM 오케스트레이션은 Vercel AI SDK
- **결정**: `ai` (Vercel AI SDK) + provider 어댑터 (`@ai-sdk/openai`, `@ai-sdk/openai-compatible`)로 LLM 호출 추상화. tool 정의는 `tool({ inputSchema: z... })`, 구조화 출력은 `generateObject`, 스트리밍은 `streamText`.
- **대안**: (a) OpenAI Agents SDK (0.1.x 앞전 버전 + 6단계 이벤트 노출 어려움), (b) LangGraph (오버스펙 — 우리는 정적 6단계 파이프라인), (c) raw OpenAI SDK (provider 추상화 부재).
- **채택 사유**: `opencode`·`Cline` 등 production OSS 코딩 에이전트가 채택한 검증된 패턴. provider 추상화로 CLIProxyAPI 통한 Claude/Gemini 라우팅 자연. `streamText`가 D-6 SSE 흐름과 1:1.

### D-5. 검증 6단계는 외부 (β) Orchestrator+Specialists + 내부 (ε) Hybrid
- **결정**: Orchestrator는 결정론 함수 (state machine). 6 Specialist의 내부 type:
  - `RAGSpecialist` — 결정론 (인터페이스 D-7)
  - `IntentSpecialist` — 단일 LLM agent (`generateObject` + Zod)
  - `GenerationSpecialist` — multi-agent team (Generator + ConstraintCritic + Refiner)
  - `SympySpecialist` — 결정론 (math-engine HTTP)
  - `ReSolveSpecialist` — 단일 LLM agent (다른 system prompt + model/temp)
  - `ObjectiveSpecialist` — 결정론 매칭 + LLM 보조 nuance (LLM은 제안만, 결정 X)
- **대안**: (α) Generator/Verifier 2-agent only, (β) Pure 6 LLM specialists, (γ) Critic-Refiner only, (δ) Multi-Agent Debate, (ε) Pure Hybrid, (i) Pure 6-function pipeline.
- **채택 사유**: 결정론 검증 게이트 (LLM은 정답 판단 X)가 D-1 원칙. (β) pure는 agent theater (Oracle 진단 — "specialist가 함수 1개+프롬프트 1개면 이름만 바뀐 함수"). (δ) Debate는 LLM 합의=정답이 D-1 위반. 본 결정은 결정론 게이트 + 진짜 multi-agent (Generation 안) + step bar UX + 모듈러 분업을 모두 충족.
- **Closes**: Q-6

### D-6. 클라이언트 ↔ agent 프로토콜은 SSE
- **결정**: Hono `streamSSE` + 클라이언트 `EventSource`. `POST /api/generate`가 `text/event-stream`으로 응답. event 종류: `step` (단계 시작/완료), `result` (최종 문제 묶음), `error` (스테이지·메시지).
- **대안**: (a) sync REST + 폴링 (step bar 라이브 노출 안됨), (b) job 큐 + 폴링/웹훅 (다중 사용자 동시성 1차 MVP scope 초과), (c) WebSocket (양방향 불필요).
- **채택 사유**: D-4 `streamText` chunk + D-5 async generator emit이 SSE와 1:1 매칭. 단방향 progress 스트리밍 표준. 프론트 `EventSource` 빌트인.
- **Closes**: Q-3

### D-7. RAG는 `RagClient` 인터페이스로 추상화, 1차 MVP 구현은 JSONL 메모리 인덱스
- **결정**: `agent`는 `RagClient` 인터페이스로만 데이터 접근 (`packages/agent/src/tools/rag-client.ts`). 1차 MVP 구현은 정규화 JSONL (2,400건, `math-sample-unified-v1` 스키마) 메모리 로드 + 구조적 필터 (학년·단원·유형·난이도). 실제 영속 저장소 선정은 인터페이스 안정 후 보류.
- **대안**: (a) Postgres + Cube 즉시 도입, (b) Postgres + pgvector, (c) 파일만 (인터페이스 없이).
- **채택 사유**: 인터페이스 안정성으로 swap 가능. 1차 MVP 일정 압박 해소. 2,400건은 메모리 200MB 미만으로 충분. "swappable RAG layer"가 발표·논문 학술적 강조점.
- **Partially closes**: Q-2 (인터페이스 closure, 영속 저장소 구현은 보류)

### D-8. 프롬프트 파일은 `.md` + YAML frontmatter
- **결정**: `packages/agent/prompts/*.md`. frontmatter에 메타데이터 (id, version, model, temperature, schema 참조, owner, updated). body는 markdown + Handlebars 변수 치환. `prompt-loader.ts`가 파싱해 `generateObject({ model, temperature, system, schema })` 메타로 매핑.
- **대안**: (a) 순수 `.yaml` (body indentation 묶임), (b) `.ts` template literal (비개발자 마찰), (c) `.prompty` (생태계 작음).
- **채택 사유**: Claude Code·Cline skill 표준 포맷. git diff 자연. 비개발자가 글 쓰듯 작성. frontmatter `version` 필드로 A/B 테스트 기반.

> 추가 결정은 Open Question을 닫을 때마다 여기에 누적한다.

---

## 8. Open Questions

> 각 항목은 **하나의 결정**으로 닫힌다. 닫히면 §7로 옮긴다.

### ~~Q-1. 1차 사용자(stakeholder)는 누구인가~~ — **Closed by D-3**
1차=학원 강사, 2차=학교 교사. 근거: `docs/product/USER_FLOW.md` §2.

### Q-2. 데이터 저장소가 필요한가, 있다면 무엇인가 — **Partially closed by D-7**
인터페이스(`RagClient`)는 D-7로 closure. 실제 영속 저장소 구현(Cube vs Postgres vs pgvector vs 파일 only)은 인터페이스 안정 후 [비할당] 담당이 결정.
**남은 선택지**: (a) JSONL + 메모리 (현재 1차 MVP), (b) PostgreSQL + 단순 SQL, (c) Postgres + Cube 시맨틱 레이어, (d) Postgres + pgvector.

### ~~Q-3. 클라이언트 ↔ agent 프로토콜~~ — **Closed by D-6**
SSE 스트리밍 (Hono `streamSSE`).

### Q-4. 어디까지가 신뢰 경계인가
**왜 묻는가**: 입력 검증·rate limit·인증의 위치를 결정.
**선택지 예시**: (a) `agent`만 외부 노출, `math-engine`은 내부망 한정,
(b) 둘 다 내부망 한정 (외부에 별도 BFF), (c) 인증 없는 PoC (1차 MVP 현재).
**관련 영향**: §5.1, §6.

### Q-5. 비용·반복 상한
**왜 묻는가**: LLM 호출 폭주 방지. 검증 실패 시 몇 회까지 재생성할지.
**선택지 예시**: (a) 요청당 최대 N회 LLM 호출 (D-5에서 retry ≤ 3 잠정), (b) 월 비용 상한 + 차단,
(c) 사용자별 quota, (d) 무제한 (개발 단계).
**관련 영향**: §5.3, §6.

### ~~Q-6. 다중 에이전트 구조~~ — **Closed by D-5**
외부 (β) Orchestrator + 6 Specialists + 내부 (ε) Hybrid.

### Q-7. 배포 형태
**왜 묻는가**: 데모 단계의 배포 형태가 §6 비기능 목표를 좌우.
**선택지 예시**: (a) 로컬 PC만, (b) 단일 VM/컨테이너, (c) 서버리스,
(d) k8s.

---

## 9. 외부 참조 (객관적 사실)

이 문서가 가정하는 외부 정보. 변경 시 본 spec도 갱신.

- 프로젝트 README — 시스템 의도와 스택
- `packages/math-engine/` — `/health`, `/solve`, `/verify`, `/simplify`,
  `/differentiate`, `/limit` 엔드포인트 (현재 main에 구현되어 있음)
- `packages/agent/` — D-3~D-8 결정 후 인터페이스·디렉토리 scaffolding 진행. 본인 ([본인])이 scaffolding 구현, 프롬프트(`prompts/*.md`)와 데이터(`data/`)는 [비할당]
- `docs/specs/domain.md` — L1 도메인 spec (Problem · Solution · Verification · Strategy)
- `docs/product/` — 사용자 측 기획 5종 + HTML preview (2026-05-07 핸드오프)
- `bootstrap-snapshot` git tag — spec 이전의 부트스트랩 구현 참조용
