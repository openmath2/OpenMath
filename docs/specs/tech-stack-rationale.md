# OpenMath 기술 스택 — 각 기술이 왜 필요한가

> 각 기술이 무엇을 하고, 왜 그걸 선택했고, 빠지면 무엇이 망가지는지 — 처음 보는 사람도 납득되도록 도식 중심으로 설명.

---

## 0. 이 문서 읽는 방법

이 문서는 OpenMath 가 쓰는 모든 핵심 기술을 다음 4 가지 질문으로 설명한다:

1. **이게 뭔가?** — 한 줄 정의
2. **OpenMath 에서 무엇을 하나?** — 도식 + 구체적 역할
3. **왜 필요한가? 빠지면 어떻게 되나?** — 실패 시나리오
4. **대안은 없었나?** — 다른 선택지와 비교

**중요:** "비유" 나 "은유" 는 가능한 한 안 쓴다. 모든 설명은 **실제 입력/출력** 으로 한다.

---

## 1. 전체 그림 한 장

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   [브라우저]                                                              │
│   사용자 (학원 강사)                                                       │
│                                                                          │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │  HTTP + SSE (Server-Sent Events)
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Frontend  —  packages/web/                                       │   │
│  │  ─────────────────────────────────────────────                    │   │
│  │  ・ Next.js 14 (App Router) — 페이지 라우팅 + 서버 렌더링            │   │
│  │  ・ React 18 + TypeScript     — UI 컴포넌트                         │   │
│  │  ・ Tailwind v4               — CSS-first 디자인 토큰                │   │
│  │  ・ KaTeX                     — 수식을 HTML+MathML 로 변환           │   │
│  │  ・ @microsoft/fetch-event-source — POST + 헤더 가능한 SSE 클라이언트 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │  HTTP POST /api/generate (SSE 응답)
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Agent  —  packages/agent/      (Node.js 22)                      │   │
│  │  ─────────────────────────────────────────────                    │   │
│  │  ・ Hono                — HTTP 서버 프레임워크                       │   │
│  │  ・ Vercel AI SDK (`ai`) — LLM 호출 추상화 (provider-agnostic)      │   │
│  │  ・ Zod                  — 런타임 스키마 검증                        │   │
│  │  ・ gray-matter + handlebars — .md 프롬프트 + YAML frontmatter      │   │
│  │  ・ SSE 어댑터            — 6 단계 진행도 실시간 송출                 │   │
│  │                                                                   │   │
│  │  역할:                                                            │   │
│  │  - S1 RAG 검색 (메모리 인덱스)                                     │   │
│  │  - S2 LLM 호출 (Intent 추출)                                       │   │
│  │  - S3 LLM 호출 (Generator/Critic/Refiner)                          │   │
│  │  - S5 LLM 호출 (독립 재풀이)                                       │   │
│  │  - S6 결정론 매칭                                                  │   │
│  │  - S4 → Math Engine HTTP 호출                                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────┬───────────────────────────────────┬───────────────────────────┘
          │                                   │
          │  HTTPS                             │  HTTP (내부)
          │                                   │
┌─────────▼──────────────────┐    ┌──────────▼────────────────────────────┐
│                            │    │                                        │
│  LLM API                   │    │  Math Engine — packages/math-engine/   │
│  (OpenAI / Claude /        │    │  ──────────────────────────────────    │
│   OpenAI-compatible)       │    │  ・ Python 3.11                         │
│                            │    │  ・ FastAPI       — HTTP API            │
│                            │    │  ・ Uvicorn       — ASGI 서버           │
│                            │    │  ・ SymPy         — 기호 수학 계산       │
│                            │    │  ・ Pydantic      — 요청/응답 검증       │
│                            │    │                                        │
│                            │    │  엔드포인트:                            │
│                            │    │  POST /solve         — 방정식 풀이      │
│                            │    │  POST /verify        — 동치성 검사       │
│                            │    │  POST /simplify      — 정규형 변환      │
│                            │    │  POST /differentiate — 미분            │
│                            │    │  POST /limit         — 극한            │
└────────────────────────────┘    └────────────────────────────────────────┘
```

**한 줄 요약:**
- **브라우저** 가 보는 건 Next.js
- **Next.js** 가 호출하는 건 Agent (Node)
- **Agent** 가 호출하는 건 두 가지 — 외부 **LLM API** 와 내부 **Math Engine (Python)**
- 진행 상태는 **SSE** 로 한 방향 흘림

---

## 2. 각 기술 상세

### 2.1 SymPy — 기호 수학 계산기

#### 이게 뭔가
파이썬 라이브러리. **숫자 계산이 아니라 기호 계산** 을 한다. 즉 `1/3 + 1/6` 을 `0.5` 가 아니라 정확히 `1/2` 로 다룬다. 방정식을 인수분해하고, 미적분을 정확히 계산한다.

#### OpenMath 에서 무엇을 하나

```
LLM 이 제시한 답:  x = 2
                    │
                    ▼
        ┌────────────────────────────┐
        │  POST /verify              │
        │  body: {                   │
        │    expr1: "2*x + 3",       │
        │    expr2: "11",            │
        │    expected_value: 2       │  ← LLM 답
        │  }                         │
        └────────────┬───────────────┘
                     │
                     ▼
           sympy.Eq(2*x+3, 11).subs(x, 2)
                     │
                     ▼
              True  /  False
                     │
                     ▼
           agent 가 받는 응답: { equivalent: true }
```

위치: [`packages/math-engine/src/routers/math.py`](../../packages/math-engine/src/routers/math.py)

#### 왜 필요한가 / 빠지면 어떻게 되나

**핵심 문제:** LLM 은 수학 *계산* 을 신뢰할 수 없다.

| LLM 단독 (SymPy 없음) | SymPy 있음 |
|---|---|
| `\sqrt{16}` → `4` (음수 해 누락) | `[4, -4]` 정확 |
| `x² − 5x + 6 = 0` → `x = 2` 만 답 | `{2, 3}` 두 해 모두 |
| `(x+1)(x−1)` 과 `x² − 1` 다른 답이라 판정 | 동치라고 판정 (`equivalent: true`) |
| `1/3 + 1/6` → 부동소수점 오차 | 정확히 `1/2` |

**빠지면:** LLM 이 만든 정답을 다시 LLM 으로 검증 → 같은 모델이 같은 편향으로 같은 오답을 만들고 같은 오답을 통과시킨다. **OpenMath 의 존재 이유가 사라진다.**

#### 대안

| 후보 | 안 채택한 이유 |
|---|---|
| Wolfram Alpha API | 외부 의존 + 호출당 과금 + rate limit + 오프라인 불가 |
| Mathematica | 라이선스 비용 + 서버 설치 복잡 |
| 자체 기호 계산기 구현 | 6 단계 게이트 1개 만들려고 1년치 노력 — 비현실적 |
| Node.js 의 mathjs | 기호 계산 깊이 부족 (방정식 풀이/인수분해 한계) |

→ **SymPy 가 유일한 합리적 선택.** 오픈소스 + Python 표준 + 학계에서 검증됨.

---

### 2.2 RAG — 검색으로 LLM 지식 보강

#### 이게 뭔가
**R**etrieval-**A**ugmented **G**eneration. LLM 에게 질문할 때, 관련 자료를 함께 같이 주는 것. OpenMath 에선 2,400 건의 한국 중등 수학 문제 데이터베이스에서 학년/단원에 맞는 참조 문제 k 개를 찾아 LLM 의 프롬프트에 함께 넣는다.

#### OpenMath 에서 무엇을 하나

```
사용자 요청
{ school_level: "middle", grade: 3,
  topic_name: "이차방정식", difficulty: "medium" }
                  │
                  ▼
   ┌──────────────────────────────────────┐
   │   RagClient.search(query)             │
   │   ─────────────────────────           │
   │   1. JSONL 파일 메모리 로드 (2,400건)   │
   │   2. 학년·단원 필터링                   │
   │   3. 토큰 오버랩 점수 계산              │
   │   4. 상위 k 개 반환                     │
   └──────────────┬───────────────────────┘
                  │
                  ▼
     RagResult[] = [
       { source_problem: {...}, score: 0.87 },
       { source_problem: {...}, score: 0.81 },
       { source_problem: {...}, score: 0.76 },
     ]
                  │
                  ▼
       다음 단계 LLM 프롬프트에 주입:
       "다음은 같은 단원의 기존 문제 예시입니다:
        1) x² − 5x + 6 = 0  ...
        2) 2x² − 3x − 2 = 0 ...
        3) ...
        위와 같은 평가 차원을 가진 새 문제를 생성하라."
```

위치: [`packages/agent/src/tools/rag-client.ts`](../../packages/agent/src/tools/rag-client.ts), 데이터: `openmath_rag_records.jsonl`

#### 왜 필요한가 / 빠지면 어떻게 되나

**핵심 문제:** LLM (예: GPT-4, Claude) 의 학습 데이터에 한국 **2022 개정 교육과정** 의 구체적 표현이 충분히 들어있다고 보장할 수 없다.

| 질문 | LLM 단독 답 | RAG 있는 답 |
|---|---|---|
| "중3 이차방정식 단원 성취기준은?" | "이차방정식 풀이..." (일반론) | `9수04-12` 코드와 정확한 문구 |
| "이 단원의 대표 문제는?" | LLM 의 일반 지식에서 추측 | 실제 한국 교과서 표준 문제 |
| "이 평가 차원에서 보존돼야 할 기법은?" | 모름 | 데이터셋에 명시된 `required_techniques` |

**빠지면:**
- LLM 이 한국 교육과정을 "그럴듯하게" 추측 → 단원이 맞는 것 같지만 미묘하게 다른 문제 생성
- 예: "중3 인수분해" 요청 → LLM 이 "고1 인수분해 (복잡한 다항식)" 수준의 문제 생성
- 강사가 "이 문제는 중3 수준 아닌데?" 발견 → 신뢰 무너짐

#### 대안

| 후보 | 안 채택한 이유 |
|---|---|
| LLM 단독 (RAG 없음) | 위 표 참조 — 교육과정 정확도 보장 안 됨 |
| 벡터 임베딩 RAG (e.g., pgvector) | 2,400 건 규모에서 토큰 오버랩으로 충분, 인프라 비용 0 |
| 외부 검색 API (Google, Bing) | 인터넷 의존 + rate limit + 데이터 일관성 깨짐 |
| 파인튜닝 (LLM 자체에 한국 교과서 학습) | 데이터 양 부족 + 업데이트마다 재학습 비용 |

→ **현재는 토큰 오버랩**, v2 에서 벡터 임베딩으로 확장 (D-7).

---

### 2.3 Vercel AI SDK — LLM 호출 추상화 (LangGraph 가 아닌 이유)

#### 이게 뭔가
TypeScript 로 LLM (OpenAI / Claude / Gemini 등) 을 같은 API 로 호출하는 라이브러리. 모델별 차이를 숨겨서 코드를 provider-agnostic 하게 만든다.

#### OpenMath 에서 무엇을 하나

```typescript
// 모델 교체가 한 줄로 끝남
const model = openai("gpt-4o");  
// → 또는 anthropic("claude-3-5-sonnet")
// → 또는 google("gemini-pro")

// 같은 API 로 호출
const { object } = await generateObject({
  model,
  schema: IntentSchema,        // Zod 스키마로 출력 강제
  prompt: "...",
});
```

위치: [`packages/agent/src/tools/llm-provider.ts`](../../packages/agent/src/tools/llm-provider.ts)

#### 왜 필요한가 / 빠지면 어떻게 되나

**문제:** 캡스톤/논문에서 "어느 모델이 가장 좋은가" 를 실험해야 한다. 모델마다 API 가 다르면 실험할 때마다 코드 절반을 다시 짠다.

```
[모델 교체 비용 비교]

OpenAI 직접 SDK 사용:
  GPT-4 → Claude 전환
    = 코드 50+ 줄 다시 작성
    = streaming 구조 다시 짜야 함
    = 함수 호출 방식 다름

Vercel AI SDK 사용:
  GPT-4 → Claude 전환
    = 한 줄 변경
```

**빠지면:**
- 모델 비교 실험 불가능 (또는 매번 큰 비용)
- streaming / function calling 등을 모델마다 다시 구현
- ablation 실험 (§5) 의 V0~V7 변형이 모두 model-coupled 코드로 묶임

#### 왜 LangGraph 가 아닌가

LangGraph 는 "복잡한 agent workflow 를 그래프로 정의" 하는 도구. 노드와 엣지로 워크플로우를 짠다.

| 항목 | LangGraph | OpenMath 의 선택 (Vercel AI SDK + 직접 orchestration) |
|---|---|---|
| 학습 곡선 | 가파름 (그래프 DSL 학습 필요) | 평탄 (그냥 async 함수) |
| 워크플로우가 동적인가 | 동적 (LLM 이 다음 노드 결정) | **정적 — 6 단계 고정** |
| 디버깅 | 그래프 추적 필요 | 그냥 stack trace |
| 결정론 보장 | 어려움 (LLM 라우팅 결과 불확실) | 쉬움 (코드 흐름 그대로) |
| 적합한 경우 | 동적 도구 선택, multi-agent 자율 협력 | 결정론적 파이프라인 |

**OpenMath 의 6 단계는 항상 같은 순서로 실행된다 (D-1 결정).** "LLM 이 다음 단계를 정한다" 라는 LangGraph 의 핵심 기능이 **여기서는 오히려 D-1 위반.** 그래서 채택 안 함.

```
OpenMath 의 흐름은 그냥 이것:

async function generate(req) {
  const rag = await s1_rag(req);
  const intent = await s2_intent(req, rag);
  const problem = await s3_generate(intent, rag);
  const verify = await s4_sympy(problem);
  if (!verify.passed) return reject();
  const resolve = await s5_resolve(problem);
  const map = await s6_objective(intent, problem);
  return finalize(problem, verify, resolve, map);
}

→ LangGraph 그래프 추상화는 필요 없음.
```

#### 대안

| 후보 | 안 채택한 이유 |
|---|---|
| OpenAI SDK 직접 | provider 종속 |
| LangChain | 무거움, 추상화 과다 |
| LangGraph | 동적 워크플로우용 — OpenMath 와 맞지 않음 |
| 자체 추상화 작성 | 바퀴 재발명 |

→ **Vercel AI SDK + 직접 async 함수 체이닝.** D-4 결정.

---

### 2.4 SSE — 한 방향 진행도 스트리밍

#### 이게 뭔가
**S**erver-**S**ent **E**vents. 서버가 클라이언트로 한 번 연결 후 **여러 이벤트를 한 방향으로** 흘려보내는 HTTP 기반 프로토콜. WebSocket 의 단방향 버전.

#### OpenMath 에서 무엇을 하나

```
브라우저                                  Agent 서버
   │                                        │
   │── POST /api/generate ──────────────────▶│
   │                                        │  (6 단계 시작)
   │◀── event: step  data: {idx:1,started}──│
   │◀── event: step  data: {idx:1,completed}│
   │◀── event: step  data: {idx:2,started}──│
   │                                        │  (Intent 추출 중...)
   │◀── event: step  data: {idx:2,completed}│
   │◀── event: step  data: {idx:3,started}──│
   │     ...                                │
   │◀── event: result  data: [{...}]────────│
   │                                        │  (연결 종료)
```

각 이벤트가 도착할 때마다 React 가 화면의 step bar 를 갱신한다. 사용자는 "지금 SymPy 검증 중" 같은 상태를 실시간으로 본다.

위치: [`packages/agent/src/server/sse/progress-stream.ts`](../../packages/agent/src/server/sse/progress-stream.ts), 클라이언트 [`packages/web/hooks/use-verification-stream.ts`](../../packages/web/hooks/use-verification-stream.ts)

#### 왜 필요한가 / 빠지면 어떻게 되나

**문제:** 6 단계 검증은 LLM 호출이 여러 번 들어가서 **30 초 ~ 2 분** 걸린다. 그 동안 사용자가 빈 화면을 보고 있으면 — "이거 망가진 거 아닌가" 의심한다.

| 방식 | 사용자 체감 |
|---|---|
| 동기 REST (SSE 없음) | 60 초간 무반응 → "망가졌나?" → 새로고침 → 비용 2 배 |
| 폴링 (1 초마다 상태 조회) | 동작은 하지만 비효율 (60 회 HTTP 요청) + 상태 lag |
| **SSE** | 실시간 진행도, 한 연결 |
| WebSocket | 양방향이라 over-spec, 인프라 복잡 |

#### 대안

| 후보 | 안 채택한 이유 |
|---|---|
| 표준 EventSource API | **POST 요청 불가, 헤더 불가** — generate 요청 본문이 큼 |
| WebSocket | 양방향 필요 없음 + 인프라 (load balancer 등) 복잡 |
| 폴링 | 비효율 + 상태 lag |
| Job queue + 이메일 알림 | 1차 MVP scope 초과 (D-6) |

→ **`@microsoft/fetch-event-source`** (POST 가능한 SSE 클라이언트). D-6 결정.

---

### 2.5 Zod — 런타임 스키마 검증

#### 이게 뭔가
TypeScript 의 **타입 정의** 와 **런타임 검증** 을 동시에 해 주는 라이브러리. TypeScript 타입은 컴파일 시점에만 검증되어 런타임에는 없다. Zod 는 런타임에도 데이터 형태를 강제한다.

#### OpenMath 에서 무엇을 하나

LLM 은 가끔 형식이 맞지 않는 출력을 한다 — 필드가 빠지거나, 숫자 자리에 문자열을 넣거나. Zod 가 이걸 잡는다:

```typescript
// 스키마 정의
const IntentSchema = z.object({
  achievement_code: z.string(),
  evaluation_dimensions: z.array(
    z.object({
      dimension: z.enum(["concept","procedure","application","reasoning"]),
      must_preserve: z.boolean(),
    })
  ),
  required_techniques: z.array(z.string()),
});

// LLM 호출 시 스키마 강제
const intent = await generateObject({
  model,
  schema: IntentSchema,   // ← 이 형식이 아니면 LLM 재호출
  prompt: "..."
});

// 받은 intent 는 IntentSchema 와 100% 일치 보장됨
```

위치: [`packages/agent/src/schemas/`](../../packages/agent/src/schemas/) (verification.schema.ts, generate-request.schema.ts 등)

#### 왜 필요한가 / 빠지면 어떻게 되나

| 시나리오 | Zod 없음 | Zod 있음 |
|---|---|---|
| LLM 이 `must_preserve` 필드를 빠뜨림 | undefined → 이후 단계에서 silent crash | 즉시 검증 실패 → 재시도 |
| LLM 이 `dimension` 값으로 `"concepts"` (오타) 반환 | 코드가 "concept" 만 처리해서 무시 | 즉시 검증 실패 → 재시도 |
| HTTP 본문이 잘못된 JSON | 런타임 오류 | 400 응답 + 명확한 에러 |
| 불변식 위반 (sympy=failed 인데 overall=verified) | 통과됨 — 디버깅 지옥 | refine() 룰로 즉시 차단 |

**불변식 코드화 예 (실제 verification.schema.ts):**
```typescript
.refine(
  (v) => !(v.overall === "verified" && v.sympy_verify.status === "failed"),
  { message: "I-V3 위반: sympy_verify.status='failed' 이면 overall ≠ 'verified'" }
)
```

이 한 줄이 §3 ablation 의 "I-V3 불변식" 을 코드 레벨에서 보장한다.

#### 대안

| 후보 | 안 채택한 이유 |
|---|---|
| TypeScript 타입만 | 런타임 검증 없음 — LLM 출력 못 잡음 |
| 직접 if-문 검증 | 50+ 필드 매번 if 작성 — 유지보수 지옥 |
| JSON Schema | TypeScript 타입과 분리 — 동기화 안 됨 |
| Yup, Joi | 비슷하지만 TypeScript 추론 약함 |

→ **Zod 가 사실상 표준.** Vercel AI SDK 도 Zod 와 통합 지원.

---

### 2.6 FastAPI — Python HTTP 서버

#### 이게 뭔가
파이썬으로 빠른 HTTP API 를 만드는 라이브러리. Pydantic 으로 요청/응답을 자동 검증하고 OpenAPI 문서를 자동 생성한다.

#### OpenMath 에서 무엇을 하나

Math Engine 의 5 개 엔드포인트 (`/solve`, `/verify`, `/simplify`, `/differentiate`, `/limit`) 를 노출한다. 각 엔드포인트는 SymPy 함수의 HTTP wrapper.

```python
class SolveRequest(BaseModel):
    expr: str
    var: str

@app.post("/solve")
def solve(req: SolveRequest):
    x = sp.symbols(req.var)
    expr = sp.sympify(req.expr)
    solutions = sp.solve(expr, x)
    return {"solutions": [str(s) for s in solutions]}
```

위치: [`packages/math-engine/src/main.py`](../../packages/math-engine/src/main.py)

#### 왜 필요한가 / 빠지면 어떻게 되나

**문제:** SymPy 는 파이썬 라이브러리고, agent 는 Node.js 다. 두 언어를 잇는 방법이 필요하다.

| 방식 | 평가 |
|---|---|
| **HTTP API (FastAPI)** | 표준, 독립 배포, 두 언어 무관 ✅ |
| node-python 브릿지 (e.g., python-shell) | 프로세스 spawn 비용, 에러 처리 복잡 |
| Node 에서 SymPy 재구현 | 비현실적 |
| WebAssembly 로 SymPy 컴파일 | Pyodide 등 가능하나 무거움 (수십 MB) |

**빠지면:** SymPy 호출이 불가능 → S4 검증 사라짐 → §3 의 S4 ablation 시나리오 = 시스템 붕괴.

#### 왜 FastAPI 인가 (다른 Python 프레임워크 대신)

| 후보 | 평가 |
|---|---|
| **FastAPI** | Pydantic 자동 검증 + 빠름 + OpenAPI 문서 자동 |
| Flask | 검증/문서 수동 — 더 많은 코드 |
| Django | 무거움, ORM 등 불필요한 기능 |
| Starlette | FastAPI 가 Starlette 기반이라 사실상 같음 |

→ **FastAPI** (D-2).

---

### 2.7 Hono — Node 의 가벼운 HTTP 서버

#### 이게 뭔가
Node / Bun / Deno 에서 동작하는 가벼운 HTTP 프레임워크. Express 의 현대 대체재.

#### OpenMath 에서 무엇을 하나

Agent 의 HTTP 엔드포인트 (`/api/generate`, `/health`) 를 노출. SSE 어댑터로 6 단계 진행도 흘림.

```typescript
const app = new Hono();

app.post("/api/generate",
  zValidator("json", GenerateRequestSchema),   // Zod 자동 검증
  async (c) => {
    return streamSSE(c, async (stream) => {
      for await (const event of pipeline(c.req.json())) {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event.data),
        });
      }
    });
  }
);
```

위치: [`packages/agent/src/server/app.ts`](../../packages/agent/src/server/app.ts)

#### 왜 필요한가 / 빠지면 어떻게 되나

| 후보 | 평가 |
|---|---|
| **Hono** | 빠름, TypeScript 우선, Zod 통합, SSE 지원 |
| Express | TypeScript 통합 약함, SSE 직접 구현 |
| Fastify | 좋음 — Hono 보다 약간 무거움 |
| Next.js API routes | 이미 Frontend 가 Next.js 이지만, **agent 는 독립 배포** 가 목표 (D-9) |

**빠지면:** HTTP 서버를 직접 짜야 함 (Node `http` 모듈 raw 핸들링) — SSE 청크 처리, CORS, 에러 핸들링 다 직접 = 비현실적.

---

### 2.8 Next.js 14 (App Router) — React 풀스택

#### 이게 뭔가
React 기반 풀스택 프레임워크. App Router 부터 **React Server Components** 를 지원해서, 서버에서 렌더 가능한 React 코드와 브라우저에서 동작하는 코드를 한 프로젝트에 섞을 수 있다.

#### OpenMath 에서 무엇을 하나

- **랜딩 페이지** (`/`) — 정적 마케팅 페이지
- **로그인 / 샘플** — 정적 페이지
- **앱 워크플로우** (`/app/*`) — 동적 사용자 입력 + SSE 상태
- **KaTeX SSR** — 수식을 서버에서 미리 HTML+MathML 로 변환 → 첫 페인트부터 수식이 보임

```
[수식 렌더링 비교]

CSR (Client-side Rendering)
  ┌─ 빈 화면
  ├─ JS 다운로드 (수십 KB)
  ├─ KaTeX 라이브러리 실행
  └─ 수식 렌더 ── 사용자 1~2초 후 봄

SSR (Server-side Rendering with Next.js)
  └─ HTML 도착 즉시 수식 보임 (raw HTML+MathML)
```

위치: [`packages/web/app/`](../../packages/web/app/)

#### 왜 필요한가 / 빠지면 어떻게 되나

| 후보 | 평가 |
|---|---|
| **Next.js 14 App Router** | SSR + 라우팅 + TypeScript + 한국 시장 친숙 ✅ |
| Vite + React Router | SSR 없음 — KaTeX 첫 페인트 blink |
| Remix | 좋음, 하지만 Next.js 가 한국에서 더 보편적 |
| 정적 사이트 (Astro 등) | 동적 폼/SSE 처리 약함 |

**빠지면:** SSR 없이 KaTeX 를 클라이언트에서 처리 → 페이지 진입 시 수식이 1~2 초 후 깜빡 → UX 후퇴.

D-9 결정.

---

### 2.9 KaTeX — 웹에서 수식 렌더링

#### 이게 뭔가
LaTeX 수식을 HTML/CSS 로 렌더링하는 JavaScript 라이브러리. MathJax 보다 빠르고 가볍다.

#### OpenMath 에서 무엇을 하나

```
LLM 이 생성한 문제 본문 (LaTeX 형식):
  "x^2 - 5x + 6 = 0 의 해를 구하시오"
                │
                ▼
        KaTeX renderToString()
                │
                ▼
   HTML + MathML 출력:
   <span class="katex">
     <span class="katex-html">x² − 5x + 6 = 0</span>
     <math xmlns="http://www.w3.org/1998/Math/MathML">
       <mrow><mi>x</mi><msup>...</msup></mrow>  ← 스크린리더가 읽음
     </math>
   </span>
```

위치: [`packages/web/components/math/latex-renderer.tsx`](../../packages/web/components/math/latex-renderer.tsx)

#### 왜 필요한가 / 빠지면 어떻게 되나

| 방식 | 결과 |
|---|---|
| LaTeX raw text 그대로 표시 | `x^{2} - 5x + 6 = 0` 그대로 보임 — 학생이 못 읽음 |
| 이미지로 렌더 (서버에서 PNG) | 줌 깨짐, 접근성 0 (스크린리더 못 읽음) |
| **KaTeX (HTML + MathML)** | 깨끗한 수식 + 줌 OK + 스크린리더 OK |
| MathJax | 가능하나 KaTeX 보다 무겁고 느림 |

**빠지면:** 학원 강사가 받은 문제에 `\frac{1}{2}` 같은 raw LaTeX 이 그대로 박혀 있음 → 사용 불가.

#### 부가 — htmlAndMathml 출력의 의의

KaTeX 옵션 `output: "htmlAndMathml"` 를 쓰면 시각적 HTML 과 의미적 MathML 이 함께 출력된다. 스크린리더 (NVDA, JAWS) 가 MathML 을 "엑스 제곱 마이너스 오 엑스 더하기 육" 같이 읽어 준다 → **접근성 준수.**

(주형님 PR 리뷰에서 지적된 부분 — `role="img" aria-label="..."` 이 MathML 을 가리는 문제도 여기서 비롯됨. 이미 fix 됨.)

---

### 2.10 Tailwind v4 — CSS-first 디자인 토큰

#### 이게 뭔가
유틸리티 클래스로 스타일을 짜는 CSS 프레임워크. v4 부터 **CSS-first config** 가 됐다 — JavaScript 설정 파일 없이 CSS 파일의 `@theme {}` 블록으로 토큰을 정의한다.

#### OpenMath 에서 무엇을 하나

```css
/* packages/web/app/globals.css */
@theme {
  --color-canvas: #fbf8f3;   /* warm ivory */
  --color-ink: #16110e;
  --color-primary: #2563eb;
  --color-pass: #4ade80;
  --color-fail: #fb7185;
  /* ... 33 개 토큰 */
}
```

```tsx
// 즉시 utility 로 사용 가능
<div className="bg-canvas text-ink">
  <button className="bg-primary">검증 시작</button>
</div>
```

#### 왜 필요한가 / 빠지면 어떻게 되나

**문제:** DESIGN.md 라는 디자인 시스템 spec 이 있고, **랜딩 (editorial)** 과 **앱 (productivity)** 두 서피스가 같은 토큰 위에서 다른 외관을 가져야 한다.

| 방식 | 평가 |
|---|---|
| **Tailwind v4 @theme** | CSS 변수로 토큰 한 번 정의 → utility 자동 생성 ✅ |
| CSS Modules | 토큰 시스템 직접 구축 필요 |
| Styled Components | 런타임 오버헤드 + RSC 호환성 문제 |
| Tailwind v3 (JS config) | 가능하나 v4 의 CSS-first 가 더 단순 |

**빠지면:** 디자인 토큰을 일일이 손으로 컴포넌트 CSS 에 반복 → 컬러 변경 시 수십 곳 수정.

---

### 2.11 gray-matter + handlebars — .md 프롬프트 시스템

#### 이게 뭔가
- **gray-matter**: Markdown 파일의 YAML frontmatter 를 파싱
- **handlebars**: `{{변수}}` 같은 템플릿 문법으로 변수 치환

OpenMath 의 모든 LLM 프롬프트는 `.md` 파일이다.

#### OpenMath 에서 무엇을 하나

```markdown
---
name: intent-extraction
version: 1.0.0
temperature: 0.2
model: gpt-4o
---

# 의도 추출

다음 사용자 요청을 분석해서 평가 차원을 추출하라:

요청: {{userRequest}}

참조 문제들:
{{#each ragResults}}
- {{this.title}}
{{/each}}

다음 스키마로 출력하라: ...
```

```typescript
// 코드에서 로드 + 변수 치환
const prompt = await loadPrompt("intent-extraction.md", {
  userRequest: req.topic_name,
  ragResults: rag,
});
```

위치: [`packages/agent/prompts/`](../../packages/agent/prompts/) (D-8)

#### 왜 필요한가 / 빠지면 어떻게 되나

| 방식 | 평가 |
|---|---|
| **.md + frontmatter (D-8)** | 비개발자도 글처럼 작성 + git diff 가능 + `version` 으로 A/B 테스트 ✅ |
| 코드 안에 string literal | 줄 길이 폭증 + 디자이너/PM 손댈 수 없음 |
| YAML/JSON 프롬프트 | 줄바꿈/이스케이프 지옥 |
| 데이터베이스 저장 | 버전 관리 어렵고 git 히스토리 없음 |

**빠지면:** 프롬프트 한 줄 수정에 코드 PR 필요 → 비개발자 (조교, 강사) 참여 불가 → 캡스톤 발표 직전 문구 다듬기 못함.

---

### 2.12 pnpm workspace — 모노레포 관리

#### 이게 뭔가
`npm` 의 대체재. 디스크 공간 절약 + 빠름. `workspace` 기능으로 한 레포 안에 여러 패키지를 묶어서 관리한다.

#### OpenMath 에서 무엇을 하나

```
OpenMath/
├── pnpm-workspace.yaml
├── packages/
│   ├── agent/        (Node, packages.json)
│   ├── web/          (Next.js, package.json)
│   └── math-engine/  (Python, pyproject.toml — pnpm 안 씀)
```

```bash
pnpm -F @openmath/web dev   # web 만 실행
pnpm dev:all                # 모두 동시 실행
```

#### 왜 필요한가 / 빠지면 어떻게 되나

| 방식 | 평가 |
|---|---|
| **pnpm workspace** | 빠름, 디스크 절약, 한 명령으로 패키지 간 동시 작업 |
| npm workspace | 가능하나 느림 |
| Lerna / Nx / Turborepo | 좋지만 over-engineering (3 패키지에 과함) |
| 별도 레포 | PR 동기화 지옥, 타입 공유 안 됨 |

**빠지면:** agent 의 Zod 스키마를 web 에서 import 못 함 → 타입 중복 정의 → 동기화 깨짐.

---

### 2.13 Python 별도 프로세스 (D-2) — 왜 한 프로세스가 아닌가

#### 결정 D-2 의 핵심

OpenMath 는 두 프로세스 (Node agent + Python math-engine) 로 분리되어 있다. 한 프로세스에 임베딩하지 않은 이유:

```
[옵션 A: 한 프로세스 — node-python 브릿지]

Node Agent
  ├── python-shell 으로 subprocess.spawn
  ├── 각 호출마다 Python interpreter 부팅 (수백 ms)
  ├── stderr/stdout pipe 파싱 (포맷 깨짐 위험)
  └── crash 시 Node 도 같이 죽음

[옵션 B: 두 프로세스 — HTTP (채택)]

Node Agent ── HTTP ──▶ Python Math Engine
                          │
                          ├── 독립 시작/재시작
                          ├── 표준 JSON 통신
                          └── 한 쪽 죽어도 다른 쪽 살아있음
```

**빠지면:** 한 프로세스 임베딩 → SymPy import 가 수백 ms → 6 단계 처리에 누적 지연. 디버깅 어려움.

---

## 3. "왜 이 조합인가" — 대안 스택과의 비교

같은 문제를 풀기 위한 다른 조합들과 OpenMath 의 차이:

| 조합 | 핵심 트레이드오프 |
|---|---|
| **OpenMath 채택** | Node (TS) agent + Python (SymPy) + Next.js 14 + SSE |
| 풀-Python (Streamlit) | 빠른 프로토타입, **하지만 사용자 UI 한계, SSE 불편, TypeScript 없음** |
| 풀-Node (mathjs) | 한 언어로 단순, **하지만 기호 계산 한계** — D-1 위반 |
| LangChain + LangGraph | 풍부한 도구, **하지만 결정론 보장 약함**, 학습곡선 |
| OpenAI Custom GPT | 빠르게 시작, **하지만 SymPy 검증 못 끼움**, 데이터 통제 X |

→ OpenMath 의 조합은 **"결정론 검증을 게이트로 강제할 수 있는가"** 라는 한 가지 기준에서 결정됨.

---

## 4. 한 줄 요약

| 기술 | 역할 | 빠지면 |
|---|---|---|
| **SymPy** | 정답을 기호 계산기로 검증 | LLM 의 오답이 그대로 사용자에게 |
| **RAG** | 한국 교과서 참조 주입 | LLM 의 일반 지식만으로 단원 어긋남 |
| **Vercel AI SDK** | LLM provider 추상화 | 모델 비교 실험 불가 |
| **SSE** | 6 단계 진행도 실시간 송출 | 60 초 무반응 → 사용자 이탈 |
| **Zod** | 런타임 스키마 + 불변식 강제 | LLM 출력 형식 깨지면 silent crash |
| **FastAPI** | Node → Python (SymPy) HTTP 다리 | SymPy 호출 자체 불가 |
| **Hono** | Node HTTP 서버 + SSE 어댑터 | HTTP/SSE 직접 구현 = 비현실적 |
| **Next.js 14** | SSR + KaTeX 첫 페인트 | 수식 1~2초 후 깜빡 |
| **KaTeX** | LaTeX → HTML+MathML 변환 | raw LaTeX 텍스트 그대로 노출 |
| **Tailwind v4** | CSS-first 디자인 토큰 | 토큰 변경 시 수십 곳 수정 |
| **gray-matter + handlebars** | .md 프롬프트 시스템 | 프롬프트 수정 시 코드 PR 필요 |
| **pnpm workspace** | 모노레포 관리 | 패키지 간 타입 공유 깨짐 |
| **Python 별도 프로세스 (D-2)** | 두 언어 분리 운영 | 한 쪽 crash 가 전체 crash |

---

## 부록 — 결정 매핑

각 기술 선택을 [`docs/specs/architecture.md`](./architecture.md) 의 결정 코드로:

| 결정 | 기술 |
|---|---|
| **D-1** | LLM (생성) 과 SymPy (검증) 분리 |
| **D-2** | Node agent + Python math-engine — 별도 프로세스, HTTP 통신, FastAPI |
| **D-3** | 1차 사용자 = 학원 강사 (인증 v2 로 연기) |
| **D-4** | Vercel AI SDK (LangChain/LangGraph 대신) |
| **D-5** | (ε) Hybrid — 결정론 게이트 + 부분 multi-agent |
| **D-6** | SSE (`@microsoft/fetch-event-source`) |
| **D-7** | RagClient 인터페이스 — 메모리 토큰 오버랩 (v2 벡터 임베딩) |
| **D-8** | .md + YAML frontmatter 프롬프트 (gray-matter + handlebars) |
| **D-9** | Next.js 14 App Router + Tailwind v4 — 듀얼 서피스 |
| **D-10** | Better Auth (v2 도입 예정) |

→ 위 4 가지 질문 ("이게 뭔가 / 무엇을 하나 / 왜 필요 / 대안") 으로 모든 기술 선택을 추적할 수 있다.
