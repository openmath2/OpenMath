# L0 Architecture Spec

| | |
|---|---|
| Status | Draft |
| Last updated | 2026-04-30 |
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

- [ ] 정의 필요 (Open Question 1 참조)

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
- [ ] 정의 필요 (Open Question 2 참조)

---

## 4. Communication Topology

### 4.1 합의된 것
- `agent` ↔ `math-engine`: HTTP/JSON, 동기 요청-응답.
- `agent` ↔ `llm-provider`: HTTPS, OpenAI 호환 API.

### 4.2 미정
- 클라이언트 ↔ `agent`의 프로토콜 (REST? streaming? SSE?)
- `agent` 내부 다중 에이전트 간 통신 (in-process? handoff?)
- 서비스 디스커버리 방식 (현재는 환경변수 `MATH_ENGINE_URL` 하드코딩)
- [ ] 정의 필요 (Open Question 3 참조)

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

> 추가 결정은 Open Question을 닫을 때마다 여기에 누적한다.

---

## 8. Open Questions

> 각 항목은 **하나의 결정**으로 닫힌다. 닫히면 §7로 옮긴다.

### Q-1. 1차 사용자(stakeholder)는 누구인가
**왜 묻는가**: 인증·요금·UX·SLA의 출발점.
**선택지 예시**: (a) 교사 — 문제집 제작용, (b) 학생 — 자가학습용,
(c) 출판사 API 고객, (d) 캡스톤 심사용 데모만.
**관련 영향**: §1.3, §5.1, §6.

### Q-2. 데이터 저장소가 필요한가, 있다면 무엇인가
**왜 묻는가**: RAG·출제전략·생성 이력 어디에 둘지.
**선택지 예시**: (a) 파일시스템 + YAML/JSON, (b) PostgreSQL + pgvector,
(c) Cube + 별도 vector store, (d) 메모리만 (캐시 없음).
**관련 영향**: §3.2, 추후 L1/L2.

### Q-3. 클라이언트 ↔ agent 프로토콜
**왜 묻는가**: 생성은 수 초~수십 초 걸릴 수 있다. 동기 REST가 적절한가?
**선택지 예시**: (a) 동기 REST + 짧은 timeout, (b) SSE 스트리밍,
(c) job 큐 + polling, (d) WebSocket.
**관련 영향**: §4, §6.

### Q-4. 어디까지가 신뢰 경계인가
**왜 묻는가**: 입력 검증·rate limit·인증의 위치를 결정.
**선택지 예시**: (a) `agent`만 외부 노출, `math-engine`은 내부망 한정,
(b) 둘 다 내부망 한정 (외부에 별도 BFF), (c) 인증 없는 PoC.
**관련 영향**: §5.1, §6.

### Q-5. 비용·반복 상한
**왜 묻는가**: LLM 호출 폭주 방지. 검증 실패 시 몇 회까지 재생성할지.
**선택지 예시**: (a) 요청당 최대 N회 LLM 호출, (b) 월 비용 상한 + 차단,
(c) 사용자별 quota, (d) 무제한 (개발 단계).
**관련 영향**: §5.3, §6.

### Q-6. 다중 에이전트 구조
**왜 묻는가**: 현재 generator/verifier 두 에이전트가 분리될지, 하나가
도구만 다르게 쓸지, handoff/orchestrator를 둘지 결정.
**선택지 예시**: (a) 단일 에이전트 + 도구 다양화, (b) generator/verifier 분리 호출,
(c) orchestrator 에이전트가 둘을 handoff, (d) 워크플로우 엔진(LangGraph 등).
**관련 영향**: §3, §4.2, 이후 L1/L2.

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
- `packages/agent/` — 현재 placeholder. 구현은 spec 합의 후 재작성
- `bootstrap-snapshot` git tag — spec 이전의 부트스트랩 구현 참조용
