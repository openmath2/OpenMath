# OpenMath Agent — 감사 후속 작업 분해 (28 태스크)

**원본:** `AUDIT_REPORT_v2.pdf` (6 페이지) 의 모든 발견 사항을 빠짐없이 분해
**작업 기준:** PDF §0 ~ §8 + AGENTS.md §9 표기 오류
**총 태스크 수:** 28 개
**완료 후 기대:** stub 0 건, 데이터 파일 모두 배치, 문서 일치, 약점 4 건 fix 완료

---

## 우선순위 분류

| 분류 | 의미 | 개수 |
|---|---|---|
| 🟢 **P0** | 즉시 — 다른 모든 task 의 dependency. 이게 없으면 P1·P2 시도조차 불가 | 5 |
| 🟡 **P1** | 다음 라운드 — P0 끝나야 동작 | 13 |
| 🔵 **P2** | 후속 — P1 완료 후 통합 | 5 |
| 🟣 **P3** | 마무리 — 문서/테스트 정리 | 5 |

---

## Phase 0 — 사전 준비 (P0, 5 태스크)

P0 stub 구현 시작하기 *전에* 반드시 끝나야 함.

---

### T-001 · `.env` 파일 생성 (packages/agent/)

- **우선순위:** 🟢 P0
- **카테고리:** 환경 설정
- **PDF 출처:** §1 사전 체크 — "`packages/agent/.env` 파일 없음 → 직접 만들어야 함"
- **파일:** `packages/agent/.env` (신규)
- **현재 상태:** `.env.example` 만 있음 (단 §2 의 mismatch 때문에 그대로 복사도 안 됨)

**해야 할 것:**
- 파일 직접 작성. `.env.example` 내용 무시하고 아래 내용 사용.

```env
NODE_ENV=development
PORT=3000
MATH_ENGINE_URL=http://localhost:8000
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=http://127.0.0.1:8317/v1
LLM_API_KEY=my-secret-key
PROMPTS_DIR=./prompts
STRATEGIES_DIR=./data/achievement-standards
CORPUS_JSONL=./data/corpus/openmath_rag_records.jsonl
MAX_RETRIES=3
PER_STEP_TIMEOUT_MS=30000
```

**완료 조건:**
- `packages/agent/.env` 존재
- 11 개 변수 모두 `src/config/env.ts` 의 `EnvSchema` 와 일치
- `pnpm -F @openmath/agent exec node --env-file=.env -e "import('./src/config/env.js').then(m=>console.log(m.loadEnv()))"` exit 0

**의존성:** 없음
**난이도:** S (5분)

---

### T-002 · `.env.example` 변수명 5건 mismatch 수정

- **우선순위:** 🟢 P0
- **카테고리:** 문서 / 환경 설정
- **PDF 출처:** §2 환경변수 이름 불일치 (5건)
- **파일:** `packages/agent/.env.example`
- **현재 상태:** 5 개 변수명이 코드와 mismatch → silent 무시됨

**해야 할 것:**
- `.env.example` 의 다음 5건 수정:

| 현재 (잘못) | 수정 (코드 일치) |
|---|---|
| `OPENAI_API_KEY=...` | `LLM_API_KEY=...` |
| `CLIPROXY_BASE_URL=...` | `LLM_BASE_URL=...` |
| `CLIPROXY_API_KEY=...` | `LLM_API_KEY=...` (중복 제거) |
| `LLM_PROVIDER=cliproxy` | `LLM_PROVIDER=openai-compatible` |
| `CLIPROXY_MODEL=...` | (삭제 — env.ts 에 없음. 모델은 config/models.ts) |

**완료 조건:**
- `.env.example` 의 모든 변수가 `src/config/env.ts` 의 `EnvSchema` enum/key 와 일치
- `grep -E "OPENAI_|CLIPROXY_" .env.example` → 0 건 (잘못된 이름 모두 제거)

**의존성:** 없음
**난이도:** S (3분)

---

### T-003 · `CritiqueSchema` 추가 (constraint-critic 용)

- **우선순위:** 🟢 P0
- **카테고리:** 스키마 추가
- **PDF 출처:** §3 프롬프트 스키마 누락 (`constraint-critic.md` 참조), §8 약점 #4
- **파일:** `packages/agent/src/schemas/critique.schema.ts` (신규)
- **현재 상태:** `constraint-critic.md` frontmatter 가 `CritiqueSchema` 참조하지만 `src/schemas/` 에 없음

**해야 할 것:**
- 새 파일 작성. 최소 형태:
```ts
import { z } from "zod";

export const CritiqueSchema = z.object({
  passes: z.boolean(),
  hints: z.array(z.string()),
});
export type Critique = z.infer<typeof CritiqueSchema>;
```
- `src/schemas/index.ts` 에 `export * from "./critique.schema.js";` 추가

**완료 조건:**
- `CritiqueSchema` import 가능 (`import { CritiqueSchema } from "../schemas/index.js"`)
- `pnpm typecheck` exit 0

**의존성:** 없음
**난이도:** S (10분)

---

### T-004 · `SolveAttemptSchema` 추가 (independent-solver 용)

- **우선순위:** 🟢 P0
- **카테고리:** 스키마 추가
- **PDF 출처:** §3, §8 약점 #4
- **파일:** `packages/agent/src/schemas/solve-attempt.schema.ts` (신규)
- **현재 상태:** `independent-solver.md` 가 `SolveAttemptSchema` 참조하지만 없음

**해야 할 것:**
- 새 파일 작성:
```ts
import { z } from "zod";

export const SolveAttemptSchema = z.object({
  derived_answer: z.string().min(1),
  trace: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
});
export type SolveAttempt = z.infer<typeof SolveAttemptSchema>;
```
- `src/schemas/index.ts` 에 export 추가

**완료 조건:**
- `SolveAttemptSchema` import 가능
- `pnpm typecheck` exit 0

**의존성:** 없음
**난이도:** S (10분)

---

### T-005 · `ObjectiveMappingNuanceSchema` 추가 (objective-mapper 용)

- **우선순위:** 🟢 P0
- **카테고리:** 스키마 추가
- **PDF 출처:** §3 (objective-mapper.md L53 TODO 명시), §8 약점 #4
- **파일:** `packages/agent/src/schemas/objective-mapping-nuance.schema.ts` (신규)
- **현재 상태:** `objective-mapper.md` 가 참조 + 자체 TODO 명시

**해야 할 것:**
- 새 파일 작성 (LLM 보조 분석 결과):
```ts
import { z } from "zod";

export const ObjectiveMappingNuanceSchema = z.object({
  matched_dimensions: z.array(z.string()),
  unmatched_dimensions: z.array(z.string()),
  nuance_comments: z.array(z.string()),
});
export type ObjectiveMappingNuance = z.infer<typeof ObjectiveMappingNuanceSchema>;
```
- `src/schemas/index.ts` 에 export 추가
- `objective-mapper.md` L53 TODO 라인 제거

**완료 조건:**
- 스키마 export
- prompt-loader 가 frontmatter `schema: ObjectiveMappingNuanceSchema` 를 lookup 시 성공
- `pnpm typecheck` exit 0

**의존성:** 없음
**난이도:** S (15분)

---

## Phase 1 — P0 도구 3개 (P0 stub 구현)

agent / step 이 모두 이 3개에 의존. **반드시 가장 먼저** 구현.

---

### T-006 · `tools/llm-provider.ts` — `resolveLanguageModel` 구현

- **우선순위:** 🟢 P0
- **카테고리:** stub 구현
- **PDF 출처:** §4 [P0-A], §0 표 "tool 3개 0/3 stub"
- **파일:** `src/tools/llm-provider.ts:24`
- **현재 상태:** ❌ stub throw — `resolveLanguageModel: not implemented yet`

**해야 할 것:**
- `@ai-sdk/openai` + `@ai-sdk/openai-compatible` 사용
- `config.kind` 에 따라 분기:
  - `openai` → `createOpenAI({ apiKey, baseURL })(modelId)`
  - `openai-compatible` / `anthropic-via-compatible` → `createOpenAICompatible({ name, baseURL, apiKey }).chatModel(modelId)`
- env 에서 `LLM_BASE_URL` 누락 시 명시적 throw (`openai-compatible` 의 경우)

**완료 조건:**
- `resolveLanguageModel({ kind: "openai-compatible", modelId: "claude-haiku-4-5-20251001", baseUrl: "http://127.0.0.1:8317/v1", apiKey: "..." })` → LanguageModel 반환
- `generateText({ model, prompt: "1+1?" })` 실제 응답 (cliproxy 거쳐)
- `npx tsx scripts/run-p0-llm.ts` → `[3/3] 실제 LLM 호출 ✅` 출력

**의존성:** T-001 (.env)
**난이도:** M (30분)

---

### T-007 · `tools/prompt-loader.ts` — `createFsPromptLoader` 구현

- **우선순위:** 🟢 P0
- **카테고리:** stub 구현
- **PDF 출처:** §4 [P0-B]
- **파일:** `src/tools/prompt-loader.ts:42`
- **현재 상태:** ❌ stub throw — `createFsPromptLoader: not implemented yet`

**해야 할 것:**
- `gray-matter` 로 .md frontmatter 파싱 (id, version, model, temperature, max_tokens, schema, variables, owner, updated)
- `handlebars` 로 body 컴파일 + 변수 치환
- `LoadedPrompt` 객체 반환 (`metadata`, `rawBody`, `render(vars)`)
- 캐싱 (hotReload === false 면 첫 로드 후 캐시)

**완료 조건:**
- 6 개 프롬프트 (problem-generator, refiner, intent-extraction, constraint-critic, independent-solver, objective-mapper) 모두 `loader.load(id)` 성공
- frontmatter 의 필수 필드 누락 시 명시적 throw (`Prompt ${id}: missing frontmatter field "${key}"`)
- `npx tsx scripts/run-p0-prompt.ts` → 6/6 ✅

**의존성:** T-003, T-004, T-005 (3 스키마 추가 후 frontmatter lookup 가능)
**난이도:** M (45분)

---

### T-008 · `tools/math-engine-client.ts` — `createMathEngineClient` 구현

- **우선순위:** 🟢 P0
- **카테고리:** stub 구현
- **PDF 출처:** §4 [P0-C]
- **파일:** `src/tools/math-engine-client.ts:73`
- **현재 상태:** ❌ stub throw — `createMathEngineClient: not implemented yet`. **단 math-engine 서버는 5/5 정상.**

**해야 할 것:**
- fetch + AbortController 로 HTTP 클라이언트 구현
- 5 메서드: `health()`, `solve()`, `verify()`, `simplify()`, `differentiate()`, `limit()` + `health()`
- `opts.timeoutMs` (default 10초) + `opts.retry` (default 2회) 지원
- non-2xx 시 명시적 throw (`math-engine ${method} ${path} HTTP ${status}: ${text}`)

**완료 조건:**
- 5 endpoint 모두 client 통해 호출 성공
- 예: `client.solve({ equation: "x**2 - 5*x + 6 = 0", variable: "x" })` → `{solutions: ["2","3"]}`
- `npx tsx scripts/run-p0-math.ts` → client 호출 부분도 ✅

**의존성:** T-001 (.env 의 `MATH_ENGINE_URL`)
**난이도:** M (30분)

---

## Phase 2 — P1 에이전트 4개 (P1 stub 구현)

P0 끝나야 시작 가능. agent 4 개 각각이 LLM 호출 + 프롬프트 사용.

---

### T-009 · `agents/generator-agent.ts` — `createGeneratorAgent` 구현

- **우선순위:** 🟡 P1
- **카테고리:** stub 구현
- **PDF 출처:** §5 P1 에이전트 4개
- **파일:** `src/agents/generator-agent.ts:32`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- `generateObject({ model, schema: GeneratorLlmOutputSchema, prompt: rendered })` 호출
- LLM 은 content-only 필드만 반환 (question_text, expected_answer, expected_choices, proposed_solution_trace)
- 서버 측에서 candidate_id (uuid), mode, source_refs, inferred_intent, generation_metadata 채움
- 최종 `GeneratedProblemSchema.parse()` 통과

**완료 조건:**
- `agent.generate(input)` → `GeneratedProblem` 객체 반환
- 검증: cliproxy 거쳐 실제 LLM 호출 후 동형 문제 생성
- `npx tsx scripts/test-generator-agent.ts` → 문제 + 정답 + 풀이 출력

**의존성:** T-006 (llm-provider), T-007 (prompt-loader)
**난이도:** L (1시간)

---

### T-010 · `agents/constraint-critic-agent.ts` — `createConstraintCriticAgent` 구현

- **우선순위:** 🟡 P1
- **카테고리:** stub 구현
- **PDF 출처:** §5
- **파일:** `src/agents/constraint-critic-agent.ts:31`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- `generateObject({ model, schema: CritiqueSchema, prompt })` 호출
- `constraint-critic.md` 프롬프트 사용
- 반환: `{ passes: boolean, hints: string[] }`
- **D-1 준수:** 수학 정답 판정 X — 형식·표현·LaTeX 정합성만

**완료 조건:**
- 깨끗한 문제 → `passes=true, hints=[]`
- 깨진 문제 (LaTeX `$` 홀수 등) → `passes=false, hints` 에 구체적 지적
- `npx tsx scripts/test-critic-agent.ts` → 2 케이스 (clean/broken) 분리 검출

**의존성:** T-003 (CritiqueSchema), T-006, T-007
**난이도:** M (45분)

---

### T-011 · `agents/refiner-agent.ts` — `createRefinerAgent` 구현

- **우선순위:** 🟡 P1
- **카테고리:** stub 구현
- **PDF 출처:** §5
- **파일:** `src/agents/refiner-agent.ts:23`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- `generateObject({ model, schema: GeneratorLlmOutputSchema })` (Generator 와 같은 출력 형태)
- 입력: prior (이전 GeneratedProblem) + intent + hints
- 출력: 수정된 GeneratedProblem (prior 의 mode 와 inferred_intent 유지 — I-G1)
- `refined_by` 메타에 "refiner" 추가, attempt++ 증가

**완료 조건:**
- `agent.refine({ prior, intent, hints })` → 수정된 `GeneratedProblem`
- prior 의 `mode` 와 `inferred_intent.objective_code` 유지
- `npx tsx scripts/test-refiner-agent.ts` → hints 반영된 새 문제 출력

**의존성:** T-006, T-007
**난이도:** M (45분)

---

### T-012 · `agents/solver-agent.ts` — `createSolverAgent` 구현

- **우선순위:** 🟡 P1
- **카테고리:** stub 구현
- **PDF 출처:** §5
- **파일:** `src/agents/solver-agent.ts:24`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- `generateObject({ model, schema: SolveAttemptSchema })` 호출
- `independent-solver.md` 프롬프트 사용 (낮은 temperature 권장)
- 반환: `{ derived_answer, trace, confidence: "high"|"medium"|"low" }`
- **D-1 준수:** 정답 판정 X — 풀이 trace 만 제공

**완료 조건:**
- `agent.solve(candidate)` → `SolveAttempt` 반환
- `npx tsx scripts/test-solver-agent.ts` → derived_answer + trace + confidence 출력

**의존성:** T-004 (SolveAttemptSchema), T-006, T-007
**난이도:** M (30분)

---

## Phase 3 — P1 단계 6개 (P1 stub 구현)

각 step 은 해당 specialist 의 얇은 wrapper. agent + tool 의존.

---

### T-013 · `steps/rag-search.ts` — `ragSearch` 구현

- **우선순위:** 🟡 P1
- **카테고리:** stub 구현
- **PDF 출처:** §6 P1 단계 6개
- **파일:** `src/steps/rag-search.ts:22`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- `deps.rag.search(query)` 호출 wrapper (RAG client 는 이미 동작 ✓)
- 입력 `GenerateRequest` → `RagQuery` 변환 (`school_level`, `grade`, `topic_name`, `difficulty`, `k`)
- 반환 `{ refs: RagResult[] }`

**완료 조건:**
- corpus JSONL (T-024) 있는 환경에서 `ragSearch({rag}, {request})` → 검색 결과
- `npx tsx scripts/test-each-stub.ts` 의 ragSearch 항목 ✅

**의존성:** T-024 (corpus JSONL) — 없으면 ENOENT
**난이도:** S (15분)

---

### T-014 · `steps/intent-extraction.ts` — `extractIntent` 구현

- **우선순위:** 🟡 P1
- **카테고리:** stub 구현
- **PDF 출처:** §6
- **파일:** `src/steps/intent-extraction.ts:32`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- `generateObject({ model, schema: IntentSchema, prompt: intent-extraction.md })` 호출
- 입력: `request` + `refs` (RAG 결과) + `strategy` (optional)
- 출력: `Intent` 객체
- `assertIntentInvariants(intent)` 호출 (I-I2 cross-field 검증)

**완료 조건:**
- LLM 호출 성공 → IntentSchema 통과
- `npx tsx scripts/test-intent-step.ts` → objective_code, evaluation_dimensions 등 출력

**의존성:** T-006, T-007
**난이도:** M (30분)

---

### T-015 · `steps/problem-generation.ts` — `generateProblem` 구현

- **우선순위:** 🟡 P1
- **카테고리:** stub 구현
- **PDF 출처:** §6
- **파일:** `src/steps/problem-generation.ts:41`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- D-5 의 유일한 multi-agent 단계
- 흐름: Generator → Critic ↔ Refiner 루프 (최대 `maxCriticRounds`, default 3)
- 흐름 상세:
  1. `generator.generate(input)` → candidate
  2. for round 1..maxRounds: `critic.critique(candidate)`
  3. critique.passes === true → break
  4. 그렇지 않으면 `refiner.refine({prior: candidate, hints: critique.hints})`
- 반환: `{ candidate, refined_by: ["generator", "critic#1", "refiner#1", ...] }`

**완료 조건:**
- Generator + Critic + Refiner 3 agent 협력 동작
- Critic 1회 통과 시 `refined_by: ["generator", "critic#1"]` (refiner 안 탐)
- `npx tsx scripts/test-remaining-steps.ts` 의 problem-generation 항목 ✅

**의존성:** T-009, T-010, T-011 (3 agents 구현 필요)
**난이도:** M (45분)

---

### T-016 · `steps/sympy-verification.ts` — `verifyWithSympy` 구현

- **우선순위:** 🟡 P1
- **카테고리:** stub 구현 — **D-1 핵심 게이트 #1**
- **PDF 출처:** §6
- **파일:** `src/steps/sympy-verification.ts:22`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- LLM 정답 vs SymPy 독립 계산 결과 비교
- 알고리즘:
  1. `candidate.question_text` 에서 방정식 추출 (LaTeX `$...$` 파싱)
  2. `candidate.expected_answer` 에서 후보 해집합 추출 (`x = 3 또는 x = 4` → `["3", "4"]`)
  3. `deps.mathEngine.solve({ equation, variable })` 호출
  4. 두 해집합 정렬 후 비교 → `passed` / `failed`
  5. 추출 불가 시 `skipped`
- 반환: `{ gate: GateResult }` (step: "sympy_verify")

**완료 조건:**
- 정상 케이스 (LLM 정답 = SymPy 답) → `passed`
- 누락 케이스 (LLM 일부만) → `failed` + `failure_detail.code: "ANSWER_MISMATCH"`
- 추출 불가 (문장제) → `skipped`
- `npx tsx scripts/test-sympy-step.ts` 의 4 케이스 모두 기대대로

**의존성:** T-008 (math-engine-client)
**난이도:** L (1시간)

---

### T-017 · `steps/independent-resolve.ts` — `independentResolve` 구현

- **우선순위:** 🟡 P1
- **카테고리:** stub 구현 — **D-1 게이트 #2**
- **PDF 출처:** §6
- **파일:** `src/steps/independent-resolve.ts:26`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- Solver agent 가 candidate 를 다시 풀이
- 그 답을 candidate 의 expected_answer 와 비교 (math-engine `/verify` 사용)
- 일치 → `passed`, 불일치 → `failed` (warning 트리거 — I-V4)
- sympyGate.status === "skipped" 면 자체도 skipped
- 반환: `{ gate: GateResult }` (step: "re_solve")

**완료 조건:**
- Solver 답 = candidate 답 → `passed`
- Solver 답 ≠ candidate 답 → `failed` + `failure_detail.code: "RESOLVE_MISMATCH"`
- 한국어/LaTeX 혼합 식 parse 실패 시 `skipped` (graceful)

**의존성:** T-008, T-012
**난이도:** L (1시간)

---

### T-018 · `steps/objective-mapping.ts` — `mapObjective` 구현

- **우선순위:** 🟡 P1
- **카테고리:** stub 구현 — **D-1 게이트 #3 (결정론)**
- **PDF 출처:** §6
- **파일:** `src/steps/objective-mapping.ts:31`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- **결정론 매칭** (LLM 보조 옵션 가능하나 판정 X — D-1)
- 검증 항목:
  1. `candidate.inferred_intent.objective_code === intent.objective_code`
  2. intent 의 `must_preserve` 차원이 candidate 에 모두 보존
  3. strategy 있으면 `required_at_least_one_of` 중 1개라도 candidate `required_techniques` 에 등장
- 모두 통과 → `passed`, 하나라도 실패 → `failed` + `failure_detail.code: "OBJECTIVE_MISMATCH"`
- 반환: `{ gate: GateResult }` (step: "objective_map")

**완료 조건:**
- 동일 code + 동일 차원 → `passed`
- code mismatch → `failed`
- must_preserve 차원 누락 → `failed`

**의존성:** 없음 (순수 결정론. strategy-loader 가 동작하면 strategy 활용 가능, T-024)
**난이도:** M (30분)

---

## Phase 4 — P2 정책 3개 (P2 stub 구현)

orchestrator (workflow) 가 이 3개에 의존.

---

### T-019 · `policies/acceptance-policy.ts` — `createAcceptancePolicy` 구현

- **우선순위:** 🔵 P2
- **카테고리:** stub 구현
- **PDF 출처:** §6.5
- **파일:** `src/policies/acceptance-policy.ts:10`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- 6 개 GateResult + attemptCount → 최종 `OverallVerdict` (verified/rejected/warning)
- 룰:
  - `attemptCount > 3` → `rejected` (I-V5)
  - `sympy_verify.failed` → `rejected` (I-V3)
  - `sympy_verify.passed` AND `objective_map.passed`:
    - `re_solve.failed` → `warning` (I-V4)
    - 그 외 → `verified` (I-V2)
  - 나머지 → `rejected`

**완료 조건:**
- 모든 passed → `verified`
- sympy failed → `rejected`
- sympy passed + re_solve failed → `warning`
- attempt 4 → `rejected` (강제)
- `npx tsx scripts/test-policies.ts` 6 케이스 모두 통과

**의존성:** 없음 (스키마만 의존)
**난이도:** S (20분)

---

### T-020 · `policies/retry-policy.ts` — `createBoundedRetryPolicy` 구현

- **우선순위:** 🔵 P2
- **카테고리:** stub 구현
- **PDF 출처:** §6.5
- **파일:** `src/policies/retry-policy.ts:22`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- `Verification` → `RetryDecision` (`{shouldRetry, nextAttempt, refinementHint?}`)
- 룰:
  - `overall === "verified" | "warning"` → 재시도 X
  - `overall === "rejected"` AND `attempt_count < maxAttempts` → 재시도 (next=current+1)
  - 그 외 → 재시도 X
- `refinementHint` 는 실패한 gate 들의 `failure_detail.message` 를 묶어서 생성 (Refiner 에 전달용)

**완료 조건:**
- rejected + attempt 1, maxAttempts 3 → `{shouldRetry: true, nextAttempt: 2, refinementHint: "..."}`
- verified → `{shouldRetry: false}`
- rejected + attempt 3 → `{shouldRetry: false}`

**의존성:** 없음
**난이도:** S (15분)

---

### T-021 · `policies/timeout-policy.ts` — `withTimeout` 구현

- **우선순위:** 🔵 P2
- **카테고리:** stub 구현
- **PDF 출처:** §6.5
- **파일:** `src/policies/timeout-policy.ts:12`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- `Promise.race([fn(), timeoutPromise])` 패턴
- 타임아웃 시 `TimeoutError` (label + ms 정보 포함) throw
- 정상 종료 시 timer cleanup

**완료 조건:**
- `withTimeout(async () => 42, { ms: 1000, label: "noop" })` → `42` 반환
- `withTimeout(async () => sleep(200), { ms: 100, label: "slow" })` → `TimeoutError` throw

**의존성:** 없음
**난이도:** S (15분)

---

## Phase 5 — P2 워크플로우 (1 stub)

전체 orchestrator. 위 17 stub (tools 3 + agents 4 + steps 6 + policies 3 + 본 task 1) 모두 끝난 후.

---

### T-022 · `workflows/verification-workflow.ts` — `runVerificationWorkflow` 구현

- **우선순위:** 🔵 P2
- **카테고리:** stub 구현 (한 줄 결론의 "17개 진입점" 중 마지막)
- **PDF 출처:** PDF 한 줄 결론 "agent 17개 진입점 전부 stub" 의 17번째
- **파일:** `src/workflows/verification-workflow.ts:51`
- **현재 상태:** ❌ stub throw

**해야 할 것:**
- `AsyncGenerator<ProgressEvent, WorkflowReturn, void>` 반환
- 6 단계 순서대로 실행 (rag → intent → generate → sympy_verify → re_solve → objective_map)
- 각 단계 시작/완료에 `step` 이벤트 yield
- `acceptance-policy` 로 최종 verdict 판정
- `retry-policy` 로 재시도 결정 (실패 시 generate 부터 다시)
- 최종 `verifications[]` 반환 (result 이벤트 yield 후)
- 모든 단계는 `withTimeout` 으로 감싸기

**완료 조건:**
- 정상 흐름: 13+ SSE 이벤트 → `verified` 도달
- sympy 실패 시 자동 재시도 (최대 3회)
- 4회 초과 → 강제 rejected
- I-V1 ~ I-V5 모든 불변식 통과

**의존성:** T-006~T-021 (위 모든 P0/P1/P2 stub)
**난이도:** L (2시간)

---

## Phase 6 — 데이터 파일 배치 (P0 priority)

stub 이 다 채워져도 이게 없으면 RAG / strategy 단계가 ENOENT 로 실패.

---

### T-023 · RAG corpus JSONL 파일 배치

- **우선순위:** 🟢 P0 (RAG step 동작 위해 필요)
- **카테고리:** 데이터 준비
- **PDF 출처:** §8 약점 #2 — "RAG corpus JSONL 파일 없음" (심각도: 높음)
- **파일:** `packages/agent/data/corpus/openmath_rag_records.jsonl` (신규 / 외부 산출)
- **현재 상태:** `find . -name "*.jsonl"` → 0건. 디렉토리 자체 없음.

**해야 할 것:**
- **담당:** 한진우 (데이터 담당)
- 2,400 건 정규화된 한국 중등 수학 문제 JSONL
- 스키마: `openmath-rag-record-v1` (id, curriculum, problem, rag, media, quality, source_trace)
- 배치 경로: `packages/agent/data/corpus/openmath_rag_records.jsonl`
- 또는 `.env` 의 `CORPUS_JSONL` 절대 경로로 지정

**완료 조건:**
- 파일 존재 + `wc -l` 로 ~2,400줄 확인
- `createInMemoryRagClient({ jsonlPath })` 호출 → 정상 로드
- `npx tsx scripts/test-rag.ts` → fixture 가 아닌 진짜 데이터로 검색 성공

**의존성:** 없음 (외부 데이터)
**난이도:** XL (한진우 산출물 — 본 감사 범위 밖)

---

### T-024 · `data/achievement-standards/` 디렉토리 + 12 YAML 파일

- **우선순위:** 🟢 P0 (strategy-loader 동작 위해 필요)
- **카테고리:** 데이터 준비
- **PDF 출처:** §8 약점 #3 — "achievement-standards YAML 디렉토리 없음" (심각도: 높음)
- **파일:** `packages/agent/data/achievement-standards/*.yaml` (12개 신규)
- **현재 상태:** 디렉토리 자체 없음 (`data/README.md` 만 있음)

**해야 할 것:**
- **담당:** 도메인 작업자 (수학 교사 / 주형)
- 12 개 핵심 단원의 출제 전략 YAML 작성
- 스키마: `StrategySchema` (code, title, school_level, grade, techniques, evaluation_dimensions, difficulty_range, problem_types_supported, structural_transforms, conceptual_transforms)
- 파일명: `<objective_code>.yaml` (예: `9수04-12.yaml`)
- I-T1 (code pattern), I-T2 (must_preserve ≥ 1), I-T3 (파일명 컨벤션), I-T4 (conceptual_transforms 없으면 mode=conceptual 불가) 준수

**완료 조건:**
- 12 YAML 파일 모두 존재
- `createFsStrategyLoader().loadAll()` → 12 strategy 객체 반환
- 각 strategy 가 `assertStrategyInvariants` 통과

**의존성:** 없음 (외부 데이터)
**난이도:** XL (도메인 작업자 — 본 감사 범위 밖)

---

## Phase 7 — non-stub 코드 약점 fix

---

### T-025 · `server/routes/health.ts` — math-engine 도달성 체크 추가

- **우선순위:** 🟡 P1 (운영 안전성)
- **카테고리:** non-stub 코드 약점 fix
- **PDF 출처:** §8 약점 #1 — "health 라우트가 math-engine 미체크" (심각도: 중간)
- **파일:** `src/server/routes/health.ts:10`
- **현재 상태:** `_mathEngine` 파라미터 받는데 호출 안 함. 항상 `{status:"ok"}` 반환.

**해야 할 것:**
- handler 안에서 `await mathEngine.health()` 호출
- math-engine 응답 성공 → `{ status: "ok", math_engine: "ok" }` 반환 (200)
- math-engine 실패 → `{ status: "degraded", math_engine: "down", error: "..." }` 반환 (503)
- 파라미터 이름 `_mathEngine` → `mathEngine` (underscore 제거 — 사용함을 명시)

**완료 조건:**
- math-engine 켜진 상태: `curl /health` → 200 + `math_engine: "ok"`
- math-engine 죽인 상태: `curl /health` → 503 + `math_engine: "down"`

**의존성:** T-008 (math-engine-client)
**난이도:** S (15분)

---

## Phase 8 — 테스트 스크립트 / 문서 수정

---

### T-026 · 테스트 스크립트 — Generator dummy 데이터 타입 수정

- **우선순위:** 🟣 P3
- **카테고리:** 테스트 코드 정리
- **PDF 출처:** §5 추가 발견 — "Generator: intent.achievementCode → 실제 타입 확인 필요"
- **파일:** 본 감사가 만든 `scripts/run-agents-realistic.ts` (또는 후속 작업자가 새로 만든 generator 테스트)
- **현재 상태:** dummy 가 `intent.achievementCode` 라는 필드를 쓰는데 실제 IntentSchema 는 `objective_code` 등 다른 이름

**해야 할 것:**
- dummy 입력을 실제 `IntentSchema` 와 일치하게 수정:
  - `intent.achievementCode` → `intent.objective_code`
  - `intent.evaluationDimensions: string[]` → `intent.evaluation_dimensions: [{id, description, must_preserve}]`
  - `intent.requiredTechniques` → `intent.required_techniques`
  - `ragResults[].sourceProblem` → `refs[].problem` (RagResult 형식)
  - `constraints.integerAnswerOnly` 제거 (스키마에 없음)

**완료 조건:**
- 수정된 dummy 가 `IntentSchema.safeParse()` 통과
- `npx tsx scripts/<수정된>.ts` 실행 시 schema 오류 없음

**의존성:** T-009 (Generator agent 본문 — 그래야 `.generate()` 까지 도달)
**난이도:** S (10분)

---

### T-027 · 테스트 스크립트 — Solver dummy 데이터 타입 수정

- **우선순위:** 🟣 P3
- **카테고리:** 테스트 코드 정리
- **PDF 출처:** §5 추가 발견 — "Solver: problem.statement → 실제 타입 확인 필요"
- **파일:** Solver 테스트 스크립트
- **현재 상태:** dummy 가 `problem.statement` 라는 필드 사용. 실제는 `candidate: GeneratedProblem` (`question_text`, `expected_answer` 등)

**해야 할 것:**
- dummy 를 `GeneratedProblem` schema 형식으로 교체:
  - `problem.statement` → `candidate.question_text`
  - candidate 객체 전체에 필수 필드 (candidate_id uuid, mode, expected_answer, proposed_solution_trace, source_refs, inferred_intent, generation_metadata) 포함

**완료 조건:**
- 수정된 dummy 가 `GeneratedProblemSchema.safeParse()` 통과
- Solver 호출 시 입력 형식 오류 없음

**의존성:** T-012 (Solver agent 본문)
**난이도:** S (10분)

---

### T-028 · `AGENTS.md §9` 표기 오류 수정

- **우선순위:** 🟣 P3
- **카테고리:** 문서 수정
- **PDF 출처:** §8 마지막 박스 — "AGENTS.md §9 표기 오류"
- **파일:** `AGENTS.md` (§9)
- **현재 상태:**
  - P1 항목에 `createInMemoryRagClient` 가 '미구현' 으로 적혀있음
  - 실제로는 `tools/rag-client.ts` 가 300줄로 완전 구현됨
  - 또한 첫 줄 "14곳 확인 가능" → 실측 21곳

**해야 할 것:**
- §9 의 `tools/rag-client.ts createInMemoryRagClient` 행 → "✅ 구현 완료 (300줄, 본 감사 범위 밖)" 같이 표시
- 첫 줄 "14곳" → "21곳 (묶음 9 행으로 표기됨)" 으로 갱신
- 또는 stub 진행도 (X/21 stub remaining) 형태로 재구성

**완료 조건:**
- AGENTS.md §9 의 모든 행 상태가 실제 코드와 일치
- 새로 구현 완료된 항목은 ✅, 미구현은 ❌ 표시

**의존성:** 없음 (또는 다른 stub 구현 진행 후 같이 갱신)
**난이도:** S (10분)

---

## 의존성 그래프 (Topological Order)

```
[Phase 0 — P0 사전준비]
  T-001 (.env)                   ──┐
  T-002 (.env.example)             │
  T-003 (CritiqueSchema)         ──┤
  T-004 (SolveAttemptSchema)     ──┤
  T-005 (ObjectiveMappingNuance) ──┤
                                   │
[Phase 1 — P0 tools]               ↓
  T-006 (llm-provider) ← T-001 ────┤
  T-007 (prompt-loader) ← T-003, T-004, T-005 ─┤
  T-008 (math-engine-client) ← T-001 ──────────┤
                                                │
[Phase 2 — P1 agents]                           ↓
  T-009 (Generator) ← T-006, T-007 ────────────┤
  T-010 (Critic) ← T-003, T-006, T-007 ────────┤
  T-011 (Refiner) ← T-006, T-007 ──────────────┤
  T-012 (Solver) ← T-004, T-006, T-007 ────────┤
                                                │
[Phase 3 — P1 steps]                            ↓
  T-013 (ragSearch) ← T-023 ───────────────────┤
  T-014 (extractIntent) ← T-006, T-007 ────────┤
  T-015 (generateProblem) ← T-009, T-010, T-011┤
  T-016 (verifyWithSympy) ← T-008 ─────────────┤
  T-017 (independentResolve) ← T-008, T-012 ───┤
  T-018 (mapObjective) ← (none, 결정론)  ──────┤
                                                │
[Phase 4 — P2 policies]                         ↓
  T-019, T-020, T-021 (독립) ──────────────────┤
                                                │
[Phase 5 — P2 workflow]                         ↓
  T-022 (runVerificationWorkflow) ← T-006~T-021┤
                                                │
[Phase 6 — 외부 데이터]                          │
  T-023 (corpus JSONL) — 한진우 산출물 ────────┤
  T-024 (12 YAML) — 도메인 작업자 ─────────────┤
                                                │
[Phase 7 — non-stub fix]                        │
  T-025 (health route) ← T-008 ────────────────┤
                                                │
[Phase 8 — 테스트/문서]                          │
  T-026 (Generator dummy) ← T-009              │
  T-027 (Solver dummy) ← T-012                 │
  T-028 (AGENTS.md §9) ──── 독립 (병렬 가능) ──┘
```

---

## 시간 추정 (구현 전용, 외부 데이터 task 제외)

| Phase | Task 수 | 합계 (난이도 기준) |
|---|---|---|
| Phase 0 (사전 준비) | 5 | 약 45분 |
| Phase 1 (P0 tools) | 3 | 약 1시간 45분 |
| Phase 2 (P1 agents) | 4 | 약 3시간 |
| Phase 3 (P1 steps) | 6 | 약 4시간 |
| Phase 4 (P2 policies) | 3 | 약 50분 |
| Phase 5 (P2 workflow) | 1 | 약 2시간 |
| Phase 7 (health fix) | 1 | 약 15분 |
| Phase 8 (정리) | 3 | 약 30분 |
| **소계 (코드 작업)** | **26** | **약 13시간** |
| Phase 6 (외부 데이터) | 2 | 외부 산출물 — 일정 별도 |
| **총** | **28** | — |

---

## 완료 체크리스트 (DoD)

전체 완료 시 다음이 모두 ✅ 이어야 함:

- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm test` exit 0 (기존 7개 + 신규 통합 테스트 추가)
- [ ] `pnpm build` 성공
- [ ] `npx tsx scripts/test-each-stub.ts` → 19/19 OK (남은 stub 0)
- [ ] `npx tsx scripts/test-pipeline.ts` → `overall: verified, attempt: 1` 도달
- [ ] AGENTS.md §9 의 stub 카운트 = 0
- [ ] `.env.example` 의 모든 변수가 `EnvSchema` 와 일치
- [ ] 6 프롬프트 모두 `prompt-loader` 로 로드 가능
- [ ] `/health` 가 math-engine 도달성 정확히 반영
- [ ] 12 YAML strategy 모두 `assertStrategyInvariants` 통과
- [ ] RAG corpus JSONL 로 진짜 문제 검색 성공

---

## PDF 원본 ↔ 태스크 매핑 (감사 누락 검증용)

| PDF 위치 | 발견 사항 | 매핑된 태스크 |
|---|---|---|
| §0 표 | agent 4개 stub | T-009, T-010, T-011, T-012 |
| §0 표 | step 6개 stub | T-013 ~ T-018 |
| §0 표 | tool 3개 stub | T-006, T-007, T-008 |
| §0 표 | policy 3개 stub | T-019, T-020, T-021 |
| §0 한 줄 결론 "17개" | workflow 1개 stub | T-022 |
| §0 기준선 표 | typecheck/test/RAG 통과 | (작업 없음 — 보존) |
| §1 | .env 파일 없음 | T-001 |
| §2 | 환경변수 mismatch 5건 | T-002 |
| §3 | 프롬프트 스키마 누락 3건 | T-003, T-004, T-005 |
| §4 [P0-A] | llm-provider stub | T-006 |
| §4 [P0-B] | prompt-loader stub | T-007 |
| §4 [P0-C] | math-engine-client stub | T-008 |
| §5 (4 agents) | agent 4 stub | T-009 ~ T-012 |
| §5 추가 발견 Generator | dummy 타입 mismatch | T-026 |
| §5 추가 발견 Solver | dummy 타입 mismatch | T-027 |
| §6 (6 steps) | step 6 stub | T-013 ~ T-018 |
| §6.5 (3 policies) | policy 3 stub | T-019 ~ T-021 |
| §7 (불변식) | 7/7 통과 | (작업 없음 — 보존) |
| §8 약점 #1 | health 미체크 | T-025 |
| §8 약점 #2 | corpus JSONL 없음 | T-023 |
| §8 약점 #3 | achievement-standards 없음 | T-024 |
| §8 약점 #4 | 스키마 3개 누락 | T-003 ~ T-005 (Phase 0 와 통합) |
| §8 마지막 박스 | AGENTS.md §9 표기 오류 | T-028 |

→ **PDF 의 모든 발견 사항이 태스크로 매핑됨. 누락 0건.**
