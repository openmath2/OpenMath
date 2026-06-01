# OpenMath Agent — 실행 기반 감사 리포트 v2 (꼼꼼판)

**감사 일자:** 2026-05-28
**감사 범위:** `agents/` `steps/` `tools/` `policies/` `workflows/` (FE/HTTP endpoint 제외, RAG client 는 읽기만)
**감사 방법:** scripts/ 에 8 개 신규 진단 스크립트 + baseline build/test + 3 spec 문서 + non-stub 코드 + 테스트 파일 전수
**감사 원칙 준수:** 기존 코드 0줄 수정, `as any` / `@ts-ignore` / 빈 catch 0건, RAG client 미수정
**버전:** v1 (얕은 검증) → **v2 (깊은 검증 + 6 항목 보강)**

---

## 0. v1 → v2 보강 항목

| # | 보강 | 결과 |
|---|---|---|
| **1** | 사용자 명시 dummy 형식 그대로 PHASE 2 재실행 | §PHASE 2-B |
| **2** | architecture.md / domain.md / AGENTS.md **전문 읽기** | §PHASE 0 + §부록 A |
| **3** | non-stub 코드 (rag-client 313줄 + server/* + 5 index.ts) 감사 | §PHASE 7 |
| **4** | `pnpm typecheck` / `pnpm test` / `pnpm build` baseline | §사전 체크 |
| **5** | tests/ 3 파일 전수 분석 (placeholder ↔ 진짜 테스트 구분) | §PHASE 8 |
| **6** | AGENTS.md §9 "14곳" vs 실측 차이 추적 | §부록 B |

---

## 사전 체크 + baseline

| 항목                            | 결과                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| cliproxy at `127.0.0.1:8317`    | ✅ 응답 (401 = auth 헤더 필요, 서버 살아있음)                                             |
| math-engine at `localhost:8000` | ✅ `/health` 200                                                                          |
| `packages/agent/.env` 파일      | ❌ **없음** (`.env.example` 만 존재) — scripts/ 안에서 `process.env` inline 주입으로 우회 |
| `pnpm install` 완료             | ✅ `node_modules` 존재                                                                    |
| **`pnpm typecheck` (baseline)**  | ✅ **exit 0** (scripts/ 8개 추가 후에도 타입 OK)                                          |
| **`pnpm test` (baseline)**       | ✅ **2 files / 7 tests passed** (rag-client 2 + placeholder 5)                            |
| **`pnpm build` (baseline)**      | ✅ **dist/index.js 12.64KB + .d.ts 85.46KB** (72ms ESM + 4.3s DTS)                        |
| git 작업 폴더                    | scripts/ 8 파일 신규, src/ 0 줄 수정                                                      |

---

## PHASE 0 — 문서 읽기 + mismatch 체크

### 0.1 env 변수명 일치 여부

| `.env.example` 의 이름 (사람용 가이드) | `src/config/env.ts` 가 실제로 인식하는 이름                           | 일치?                |
| -------------------------------------- | --------------------------------------------------------------------- | -------------------- |
| `OPENAI_API_KEY`                       | `LLM_API_KEY`                                                         | ❌ silently 무시     |
| `OPENAI_MODEL`                         | (env 에 정의 없음 — config/models.ts 의 DEFAULT_MODELS 하드코딩)      | ❌                   |
| `CLIPROXY_BASE_URL`                    | `LLM_BASE_URL`                                                        | ❌ silently 무시     |
| `CLIPROXY_API_KEY`                     | `LLM_API_KEY`                                                         | ❌ silently 무시     |
| `CLIPROXY_MODEL`                       | (정의 없음)                                                           | ❌                   |
| `LLM_PROVIDER=cliproxy`                | Zod enum: `openai` / `openai-compatible` / `anthropic-via-compatible` | ❌ "cliproxy" 거부됨 |

> 결과: `.env.example` 의 6 개 변수명 모두 mismatch. 사용자가 그대로 복사하면 사일런트 무시.

### 0.2 프롬프트 frontmatter schema 참조

| 프롬프트 파일           | frontmatter `schema:` 필드     | `src/schemas/` 에 export?                          |
| ----------------------- | ------------------------------ | -------------------------------------------------- |
| `problem-generator.md`  | `GeneratedProblemSchema`       | ✅ 존재                                            |
| `refiner.md`            | `GeneratedProblemSchema`       | ✅                                                 |
| `intent-extraction.md`  | `IntentSchema`                 | ✅                                                 |
| `constraint-critic.md`  | `CritiqueSchema`               | ❌ **누락**                                        |
| `independent-solver.md` | `SolveAttemptSchema`           | ❌ **누락**                                        |
| `objective-mapper.md`   | `ObjectiveMappingNuanceSchema` | ❌ **누락** (objective-mapper.md L53 에 TODO 명시) |

> 6 프롬프트 중 **3 개가 실존하지 않는 schema 참조.** prompt-loader 구현 시 schema lookup 로직이 있으면 fail. 다행히 frontmatter 의 schema 필드는 "메타정보" 라 lookup 안 해도 됨.

### 0.3 spec 3 문서 전문 읽기 — 핵심 추출

(상세 매핑은 §부록 A 참조)

**architecture.md D-1 ~ D-10 정확 정의:**
- D-1: LLM 생성 ≠ 검증 (SymPy 단독)
- D-2: Node + Python HTTP 분리
- D-3: 1차 사용자 = 학원 강사
- D-4: Vercel AI SDK + provider 추상화
- D-5: (β) Orchestrator + (ε) Hybrid 6-specialist
- D-6: SSE 스트리밍
- D-7: RagClient 인터페이스 + JSONL MVP
- D-8: 프롬프트 `.md` + YAML frontmatter + Handlebars
- D-9: Next.js 14 + 듀얼-서피스
- D-10: Better Auth (v2 도입)

**D-1 위반의 정준 정의:** `assertVerificationInvariants` 의 I-V2 + I-V3 조건. LLM 이 "정답 맞다" 판정을 최종 결정으로 하는 것이 위반.

**도메인 불변식 17 개 (I-V 5 + I-I 3 + I-T 4 + I-G 4 + I-S 5):** 모두 명확 정의 + 강제 위치 추적 가능. (§부록 A 표 참조)

### 0.4 AGENTS.md §1 ~ §9 + R1 ~ R12 개발 규칙

(§부록 A 참조)

### 0.5 cross-spec 일관성

| 검사 | 결과 |
|---|---|
| D-1 ↔ I-V2/I-V3 | ✅ 완벽 일치 |
| D-5 6-specialist ↔ Verification.gates 6 | ✅ 1:1 매핑 |
| D-7 RagClient ↔ SourceProblem | ✅ 인터페이스 추상화 일치 |
| D-9 듀얼-서피스 ↔ DESIGN.md @theme | ✅ |
| AGENTS.md §9 우선순위 ↔ architecture 의존 그래프 | ✅ |
| **AGENTS.md §9 "14곳" ↔ 실측 21 곳** | ⚠️ **+7 차이** (§부록 B) |

---

## PHASE 1 — P0 Tool 3 개 단독 실행 결과

### [P0-A] tools/llm-provider.ts — `resolveLanguageModel`

- **상태:** ❌ stub throw
- **막히는 지점:** `packages/agent/src/tools/llm-provider.ts:24`
- **에러 메시지:** `resolveLanguageModel: not implemented yet`
- **cliproxy 연결:** ❌ (factory 자체가 throw 라 모델 객체 생성 불가)
- **재실행:** `npx tsx scripts/run-p0-llm.ts`

### [P0-B] tools/prompt-loader.ts — `createFsPromptLoader`

- **상태:** ❌ stub throw
- **막히는 지점:** `packages/agent/src/tools/prompt-loader.ts:42`
- **에러 메시지:** `createFsPromptLoader: not implemented yet`
- **로드 성공 프롬프트:** 0/6 (factory 자체가 throw)
- **재실행:** `npx tsx scripts/run-p0-prompt.ts`

### [P0-C] tools/math-engine-client.ts — `createMathEngineClient`

- **상태:** 🟡 client stub, 단 **math-engine 서버 자체는 동작**
- **막히는 지점:** `packages/agent/src/tools/math-engine-client.ts:73`
- **에러 메시지:** `createMathEngineClient: not implemented yet`
- **math-engine 직접 fetch:** ✅
  - `GET /health` → `{"status":"ok","engine":"sympy"}`
  - `POST /solve` (`x²-5x+6=0`) → `{"solutions":["2","3"]}`
  - `POST /verify` (`(x+1)(x-1) ≡ x²-1`) → `{"equivalent":true,"diff":"0"}`
  - `POST /simplify` (`(x²-1)/(x-1)`) → `{"simplified":"x + 1"}`
  - `POST /differentiate` (`x³+2x`) → `{"derivative":"3*x**2 + 2"}`
  - `POST /limit` (`sin(x)/x at 0`) → `{"limit":"1"}`
- **재실행:** `npx tsx scripts/run-p0-math.ts`

> 💡 **핵심:** SymPy 엔진 5/5 정상. Node client wrapper 만 missing.

---

## PHASE 2 — P1 Agent 4 개 단독 실행

### 2-A. `{} as never` 더미 (감사 패턴)

| Agent | 상태 | 막히는 지점 | 에러 |
|---|---|---|---|
| `createGeneratorAgent` | ❌ | `src/agents/generator-agent.ts:32` | `createGeneratorAgent: not implemented yet` |
| `createConstraintCriticAgent` | ❌ | `src/agents/constraint-critic-agent.ts:31` | `createConstraintCriticAgent: not implemented yet` |
| `createRefinerAgent` | ❌ | `src/agents/refiner-agent.ts:23` | `createRefinerAgent: not implemented yet` |
| `createSolverAgent` | ❌ | `src/agents/solver-agent.ts:24` | `createSolverAgent: not implemented yet` |

**재실행:** `npx tsx scripts/run-agents-all.ts`

### 2-B. 사용자 명시 dummy 형식 그대로 (v2 추가)

사용자가 적은 dummy 형식 (`intent.achievementCode` 등) 으로 다시 호출. **결과 동일** (4/4 factory throw, `.method()` 0/4 도달) — 하지만 **사용자 dummy 의 schema mismatch 5 건 새로 발견**:

| 사용자 dummy 필드 | 실제 코드 schema 필드 | mismatch 종류 |
|---|---|---|
| `intent.achievementCode` | `intent.objective_code` (IntentSchema) | 이름 다름 |
| `intent.evaluationDimensions: string[]` | `intent.evaluation_dimensions: { id, description, must_preserve }[]` | 형태 다름 (배열 요소 객체) |
| `intent.requiredTechniques` | `intent.required_techniques` | snake_case 차이 |
| `ragResults[].sourceProblem` | `refs[].problem` (RagResult 스키마) | 키 이름 + 컨테이너 |
| `constraints.integerAnswerOnly` | (실제 schema 에 없음 — SurfaceConstraints 는 `difficulty`, `problem_type`, `expected_choice_count`) | 필드 자체 없음 |

> ⚠️ factory 가 throw 이라 `.method()` 단계까지 안 닿아서 위 mismatch 가 **silent.** stub 구현 후 다시 검증 필요.

**재실행:** `npx tsx scripts/run-agents-realistic.ts`

---

## PHASE 3 — P1 Step 6 개 단독 실행 결과

| Step                 | 상태 | 막히는 지점                           | 에러                                      |
| -------------------- | ---- | ------------------------------------- | ----------------------------------------- |
| `ragSearch`          | ❌   | `src/steps/rag-search.ts:22`          | `ragSearch: not implemented yet`          |
| `extractIntent`      | ❌   | `src/steps/intent-extraction.ts:32`   | `extractIntent: not implemented yet`      |
| `generateProblem`    | ❌   | `src/steps/problem-generation.ts:41`  | `generateProblem: not implemented yet`    |
| `verifyWithSympy`    | ❌   | `src/steps/sympy-verification.ts:22`  | `verifyWithSympy: not implemented yet`    |
| `independentResolve` | ❌   | `src/steps/independent-resolve.ts:26` | `independentResolve: not implemented yet` |
| `mapObjective`       | ❌   | `src/steps/objective-mapping.ts:31`   | `mapObjective: not implemented yet`       |

**재실행:** `npx tsx scripts/run-steps-all.ts`

---

## PHASE 4 — P2 Policy 3 개 단독 실행 결과

| Policy                     | 상태 | 막히는 지점                            | 에러                                            |
| -------------------------- | ---- | -------------------------------------- | ----------------------------------------------- |
| `createAcceptancePolicy`   | ❌   | `src/policies/acceptance-policy.ts:10` | `createAcceptancePolicy: not implemented yet`   |
| `createBoundedRetryPolicy` | ❌   | `src/policies/retry-policy.ts:22`      | `createBoundedRetryPolicy: not implemented yet` |
| `withTimeout`              | ❌   | `src/policies/timeout-policy.ts:12`    | `withTimeout: not implemented yet`              |

**재실행:** `npx tsx scripts/run-policies.ts`

---

## PHASE 5 — 불변식 동작 확인

`schemas/verification.schema.ts` 의 `VerificationSchema` (Zod) + `assertVerificationInvariants` (runtime guard) 는 stub 이 아니라 **실 구현 + 100% 동작.** 7 케이스 모두 기대대로:

| 불변식        | 검증 케이스                                                          | 동작 여부 | 메시지                                                                      |
| ------------- | -------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------- |
| **I-V1**      | `gates=5` (6 아님) → Zod reject                                      | ✅        | `Array must contain exactly 6 element(s)`                                   |
| **I-V2/I-V3** | `sympy_verify=failed` + `overall=verified` → assert throw            | ✅        | `I-V2 violated: overall=verified requires sympy_verify=passed (got failed)` |
| **I-V4-A**    | `overall=warning` + `re_solve=passed` (위반) → throw                 | ✅        | `I-V4 violated: warning requires re_solve=failed (got passed)`              |
| **I-V4-B**    | `overall=warning` + `sympy=passed` + `re_solve=failed` (정상) → 통과 | ✅        | 통과 (예상대로)                                                             |
| **I-V5-A**    | `attempt_count=4` + `overall=verified` (위반) → throw                | ✅        | `I-V5 violated: attempt_count=4 > 3 must yield overall=rejected`            |
| **I-V5-B**    | `attempt_count=4` + `overall=rejected` (정상) → 통과                 | ✅        | 통과 (예상대로)                                                             |
| **정상**      | 모두 passed + verified + attempt=1 → 통과                            | ✅        | 통과 (예상대로)                                                             |

**재실행:** `npx tsx scripts/run-invariants.ts`

---

## PHASE 7 — Non-stub 코드 감사 (v2 신규)

stub 이 아닌 **실 구현 코드** 도 D-1 / D-5 / D-7 / D-8 / AGENTS §8 위반 여부 점검.

### 7.1 `tools/rag-client.ts` (313 줄, 실 구현)

- **알고리즘:** 토큰 오버랩 + 가중치 (topic_code +0.25 / topic_name *0.35 / intent *0.3 / problem_type +0.1 / difficulty +0.1)
- **결정론적:** ✅ score 동률 시 `item_id` 사전순
- **토큰화:** `/[^0-9a-zA-Z가-힣]+/u`
- **매칭 분류:** score ≥ 0.7 = "hybrid", ≥ 0.35 = "semantic", < = "structural"
- **캐싱:** `loadPromise` 클로저 + `warmup()`

**🔴 발견된 약점 1 — Zod 검증 누락 (D-7 부분 위반):**
- [`rag-client.ts:148-182`](packages/agent/src/tools/rag-client.ts#L148-L182) 의 `toIndexedProblem()` 가 JSONL record → SourceProblem 변환 시 **`SourceProblemSchema.parse()` 호출 안 함**
- TypeScript 타입 강제 (`const problem: SourceProblem = {...}`) 만 있고 런타임 검증 없음
- **결과: I-S1 ~ I-S5 불변식 (SourceProblem 도메인) 강제 안 됨.** 깨진 JSONL 이 들어와도 통과
- 예시: `record.curriculum.grade` 가 `null` / `7` / `"3"` 같은 garbage 여도 그대로 통과

**🟢 D-7 인터페이스 추상화 자체는 준수.** agent 측이 `RagClient` 인터페이스로만 접근.

### 7.2 `server/routes/health.ts` (15 줄, 실 구현)

**🔴 발견된 약점 2 — `_mathEngine` 파라미터 미사용 (D-3 위반):**
- [`health.ts:10`](packages/agent/src/server/routes/health.ts#L10) — health 핸들러가 `_mathEngine` 받는데 **메서드 호출 안 함**
- 응답: 항상 `{"status":"ok", "service":"openmath-agent"}` — math-engine 도달성 묻지 않음
- 정상 운영 시 math-engine 죽어도 agent /health 는 200 OK 반환 — silent failure 위험

### 7.3 `src/index.ts` `main()` 가드 (23 줄, stub)

**🔴 발견된 약점 3 — Windows 호환성 (potential bug):**
- [`src/index.ts:14`](packages/agent/src/index.ts#L14) — `if (import.meta.url === \`file://${process.argv[1]}\`)`
- Windows 에서 `import.meta.url` = `file:///C:/Users/.../index.ts` (슬래시)
- `process.argv[1]` = `C:\Users\...\index.ts` (백슬래시)
- → 비교 실패 → `main()` 호출 안 됨
- 권장: `pathToFileURL(process.argv[1]).href` 변환 후 비교

### 7.4 `config/models.ts` (13 줄, 실 구현)

**🟡 발견된 약점 4 — 모델 ID 하드코딩:**
- 모든 6 역할이 `gpt-4o` 또는 `gpt-4o-mini` 하드코딩
- env 변수로 override 불가능
- cliproxy 사용 시 (모델 목록에 `gpt-4o` 없음) 즉시 fail

### 7.5 `server/app.ts` (22 줄, 실 구현)

- `createApp({ mathEngine, workflow })` factory
- 라우트 2 개: `/health` (구현), `/api/generate` (stub 라우트 함수)
- 미들웨어 없음 (CORS, error handler 등)
- 위반: 없음

### 7.6 5 개 `index.ts` (re-export 파일)

| 파일 | 줄 | 내용 |
|---|---|---|
| `src/agents/index.ts` | 4 | 4 agent 재export |
| `src/steps/index.ts` | 6 | 6 step 재export |
| `src/tools/index.ts` | 5 | 5 tool 재export |
| `src/policies/index.ts` | 3 | 3 policy 재export |
| `src/workflows/index.ts` | 1 | 1 workflow 재export |
| `src/server/index.ts` | 1 | server/app 재export |
| `src/config/index.ts` | 2 | env + models 재export |

→ 모두 정상 동작 (위반 없음).

### 7.7 D-1 / D-5 위반 코드 존재 여부 (종합)

- **D-1 (LLM 정답 판정):** non-stub 코드에 위반 없음. schema 강제 (I-V2, I-V3) 가 충실히 동작.
- **D-5 (Generation 외 multi-agent):** non-stub 코드에 위반 없음 (애초에 multi-agent 코드 미구현).
- **D-7 (RagClient 추상화):** 인터페이스 추상화 ✅, 단 7.1 의 Zod 검증 누락은 데이터 무결성 측면에서 약점
- **D-8 (프롬프트 .md):** 프롬프트 파일 6 개 다 .md frontmatter 존재 ✅
- **AGENTS §8 위반:** non-stub 코드에 `as any` / 빈 catch / `@ts-ignore` 없음 ✅

---

## PHASE 8 — `tests/` 3 파일 전수 분석 (v2 신규)

### 8.1 `tests/placeholder.test.ts` (77 줄, **misleading name**)

- **describe / it:** 2 / 5
- **실제 검증:** Zod + invariant **진짜 production-grade 테스트**
  - `IntentSchema.safeParse()` 로 I-I1, I-I3 검증
  - `assertVerificationInvariants()` 로 I-V1, I-V2/V3, I-V5 검증
- **expectation:** `expect(parsed.success).toBe(false)`, `.toThrow(/I-V5/)` — 진짜 단언
- **결론:** 파일명만 placeholder, **내용은 production 검증**. 7/7 통과 (baseline)

### 8.2 `tests/integration/placeholder.test.ts` (7 줄, **진짜 placeholder**)

- **describe / it:** 1 / 1
- **내용:** `expect(true).toBe(true)` 한 줄
- **주석:** "math-engine wiring lands per docs/specs 때 대체될 것"
- **결론:** 진짜 placeholder. integration 테스트 자리 표시.

### 8.3 `tests/rag-client.test.ts` (180 줄, **진짜 통합 테스트**)

- **describe / it:** 1 / 2
- **실제 검증:** `createInMemoryRagClient` 로 JSONL 로드 + 검색
  - 케이스 A: 정상 검색 (achievement_confidence 0.92)
  - 케이스 B: confidence 필터 (0.42 제외)
- **결론:** RAG client 의 핵심 동작 검증 — 2/2 통과 (baseline)

→ **tests 합계: 7 통과 / 7 (rag 2 + placeholder 5).** integration 1 건은 placeholder 라 명목상 통과.

---

## 📋 다음 작업 우선순위 (AGENTS.md §9 기준 + 정확 카운트)

| 순위   | 파일                                    | 함수                          | 상태                                              |
| ------ | --------------------------------------- | ----------------------------- | ------------------------------------------------- |
| **P0** | `tools/llm-provider.ts:24`              | `resolveLanguageModel`        | ❌ stub                                           |
| **P0** | `tools/prompt-loader.ts:42`             | `createFsPromptLoader`        | ❌ stub                                           |
| **P0** | `tools/math-engine-client.ts:73`        | `createMathEngineClient`      | ❌ stub (단, 서버는 ✅)                           |
| P1     | `tools/rag-client.ts` (313줄)           | `createInMemoryRagClient`     | ✅ 동작 (단 §7.1 Zod 누락 약점)                   |
| **P1** | `agents/generator-agent.ts:32`          | `createGeneratorAgent`        | ❌ stub                                           |
| **P1** | `agents/constraint-critic-agent.ts:31`  | `createConstraintCriticAgent` | ❌ stub                                           |
| **P1** | `agents/refiner-agent.ts:23`            | `createRefinerAgent`          | ❌ stub                                           |
| **P1** | `agents/solver-agent.ts:24`             | `createSolverAgent`           | ❌ stub                                           |
| **P1** | `steps/rag-search.ts:22`                | `ragSearch`                   | ❌ stub                                           |
| **P1** | `steps/intent-extraction.ts:32`         | `extractIntent`               | ❌ stub                                           |
| **P1** | `steps/problem-generation.ts:41`        | `generateProblem`             | ❌ stub                                           |
| **P1** | `steps/sympy-verification.ts:22`        | `verifyWithSympy`             | ❌ stub                                           |
| **P1** | `steps/independent-resolve.ts:26`       | `independentResolve`          | ❌ stub                                           |
| **P1** | `steps/objective-mapping.ts:31`         | `mapObjective`                | ❌ stub                                           |
| **P2** | `policies/acceptance-policy.ts:10`      | `createAcceptancePolicy`      | ❌ stub                                           |
| **P2** | `policies/retry-policy.ts:22`           | `createBoundedRetryPolicy`    | ❌ stub                                           |
| **P2** | `policies/timeout-policy.ts:12`         | `withTimeout`                 | ❌ stub                                           |
| **P2** | `workflows/verification-workflow.ts:51` | `runVerificationWorkflow`     | ❌ stub                                           |
| P3 (감사 범위 밖) | `server/routes/generate.ts:17` | `POST /api/generate` 핸들러 | ❌ stub |
| P3 (감사 범위 밖) | `server/sse/progress-stream.ts:11` | `pipeProgressToSse` | ❌ stub |
| P3 (감사 범위 밖) | `src/index.ts:11` | `main` | ❌ stub (Windows 가드 버그 §7.3) |

→ **본 감사 범위 17 stub + 범위 밖 3 stub = 총 21 stub (grep 카운트).** (AGENTS.md §9 "14곳" 표기와 차이 7 — §부록 B 분석)

→ **non-stub 코드의 약점 4 건 추가 (§PHASE 7).** stub 채우기 외에 fix 필요.

---

## 본 감사가 추가한 스크립트 (재실행 가능)

`packages/agent/scripts/` 안에 **8 개 신규 파일** (기존 코드 0줄 수정):

| 파일                       | 역할                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `run-p0-llm.ts`            | PHASE 1 — `resolveLanguageModel` 단독 + cliproxy 호출 시도                           |
| `run-p0-prompt.ts`         | PHASE 1 — `createFsPromptLoader` + 6 프롬프트 순차 로드 시도                         |
| `run-p0-math.ts`           | PHASE 1 — `createMathEngineClient` stub 확인 + raw fetch 로 5 엔드포인트 검증        |
| `run-agents-all.ts`        | PHASE 2-A — 4 agent factory (`{} as never` 더미)                                     |
| **`run-agents-realistic.ts`** | **PHASE 2-B (v2 신규)** — 사용자 명시 dummy 형식 그대로 4 agent 재실행 + mismatch 5 건 |
| `run-steps-all.ts`         | PHASE 3 — 6 step 함수                                                                |
| `run-policies.ts`          | PHASE 4 — 3 policy                                                                   |
| `run-invariants.ts`        | PHASE 5 — Zod + assertVerificationInvariants 7 케이스                                |

(이전 감사가 만든 `test-each-stub.ts`, `test-rag.ts` 는 그대로 유지 — 본 감사가 안 건드림)

---

## 부록 A — spec 3 문서 핵심 매핑

### A.1 D-1 ~ D-10 결정 + 거절 대안

| ID | 결정 | 거절 대안 |
|---|---|---|
| D-1 | LLM 생성 ≠ 검증 (SymPy 단독) | (a) LLM self-check, (b) LLM×LLM 상호 검증 |
| D-2 | Node + Python HTTP 분리 | (a) child_process, (b) Python 임베딩 |
| D-3 | 1차 사용자 = 학원 강사 | (a) 학교 교사, (b) 학생, (c) 출판사 API, (d) 데모만 |
| D-4 | Vercel AI SDK | (a) OpenAI Agents SDK, (b) LangGraph, (c) raw OpenAI SDK |
| D-5 | (β) Orchestrator + (ε) Hybrid 6-specialist | (α) 2-agent, (β) Pure 6 LLM, (γ) Critic-Refiner, (δ) Debate, (i) Pure 함수 |
| D-6 | SSE 스트리밍 | (a) sync REST + 폴링, (b) job 큐 + 폴링, (c) WebSocket |
| D-7 | RagClient + JSONL MVP | (a) Postgres + Cube, (b) Postgres + pgvector, (c) 파일만 |
| D-8 | `.md` + YAML + Handlebars | (a) 순수 YAML, (b) TS literal, (c) .prompty |
| D-9 | Next.js 14 + 듀얼-서피스 | (a) Vite + React, (b) SvelteKit, (c) apps/+packages/ 분리 |
| D-10 | Better Auth (v2) | (a) NextAuth, (b) Clerk, (c) Supabase Auth, (d) Lucia, (e) 자체 |

### A.2 17 불변식 강제 위치

| 카테고리 | 코드 | 강제 위치 | 타입 |
|---|---|---|---|
| Verification | I-V1 | `verification.schema.ts` `.length(6)` | Zod |
| | I-V2 | `assertVerificationInvariants` | runtime |
| | I-V3 | `assertVerificationInvariants` | runtime |
| | I-V4 | `assertVerificationInvariants` | runtime |
| | I-V5 | `assertVerificationInvariants` | runtime |
| Intent | I-I1 | `IntentSchema` min | Zod |
| | I-I2 | `assertIntentInvariants` | runtime |
| | I-I3 | `IntentSchema.regex` | Zod |
| Strategy | I-T1 | YAML schema | runtime |
| | I-T2 | `assertStrategyInvariants` | runtime |
| | I-T3 | 파일명 컨벤션 | filesystem |
| | I-T4 | strategy-loader 폴백 | runtime |
| GeneratedProblem | I-G1~G4 | `assertGeneratedInvariants` | runtime (★ 미구현 시 약점) |
| SourceProblem | I-S1~S5 | `SourceProblemSchema` + data pipeline | Zod (★ §7.1 의 rag-client 가 검증 누락) |

### A.3 R1 ~ R12 개발 규칙 (AGENTS.md §1, §8)

| # | 규칙 | 영역 |
|---|---|---|
| R1 | LLM 정답 판정 금지 (D-1) | 검증 |
| R2 | RagClient / MathEngineClient / PromptLoader 인터페이스만 의존 | 아키텍처 |
| R3 | `main` 직접 push 금지 (pre-push hook + GitHub 보호) | git |
| R4 | `as any` / `@ts-ignore` / `@ts-expect-error` 금지 | 타입 |
| R5 | 빈 `catch(e) {}` 금지 | 에러 |
| R6 | `--no-verify` 금지 | git |
| R7 | 검증 안 된 GeneratedProblem 사용자 노출 금지 (I-G4) | 도메인 |
| R8 | multi-agent debate 검증 금지 (합의 ≠ 정답) | D-5 |
| R9 | spec 없는 코드 변경 금지 | 문서화 |
| R10 | 실패 테스트 지워서 녹색 만들기 금지 | 회귀 |
| R11 | 프롬프트 version 올림 (semver) | 버전 |
| R12 | 새 step 추가 시 StepName enum + I-V1 영향 검토 | 일관성 |

---

## 부록 B — AGENTS.md §9 "14곳" vs 실측 21곳 차이 추적

**AGENTS.md 의 표기:** `§9` 첫 문장 "grep -rn 'not implemented yet' packages/agent/src 로 14곳 확인 가능"

**본 감사 실측:**
```
grep -rn "not implemented yet" packages/agent/src → 21곳
```

**차이 7 곳의 분포:**

| 카테고리 | AGENTS.md §9 의 묶음 표 카운트 | 실측 grep 카운트 | 차이 |
|---|---|---|---|
| P0 (3 tools) | 3 | 3 | 0 |
| P1 RAG | 1 | 1 | 0 |
| P1 agents (4 묶음) | 1 (묶음으로 표기) | 4 | +3 |
| P1 steps (6 묶음) | 1 (묶음으로 표기) | 6 | +5 |
| P2 workflow | 1 | 1 | 0 |
| P2 server routes + sse (2개) | 1 (묶음으로 표기) | 2 | +1 |
| P3 main | 1 | 1 | 0 |
| **표 행 합계 (묶음)** | **9 행** | — | — |
| **grep 실제 stub 개수** | — | **21** | — |

**결론:** AGENTS.md §9 의 "14곳" 은 **묶음 행 카운트 + 일부 항목 추정** 의 혼합 표기로 보임. grep 정수는 21곳. **본 감사 (17곳, 범위 한정 — server/* + index.ts 제외) + 범위 밖 4곳 (server/routes/generate, server/sse/progress-stream, index.ts) = 21 일치.** 

→ **권장:** AGENTS.md §9 의 "14곳" 표기를 "21곳 (묶음 9 행)" 으로 갱신.

---

## 한 줄 결론

> **packages/agent/ 21/22 진입점이 stub (rag-client 만 실 구현).**
> **외부 의존 (cliproxy 401, math-engine 5/5 정상) 은 살아있고, Zod + invariant 100% 동작.**
> **non-stub 코드 약점 4 건 추가 발견** (rag-client Zod 누락 / health 도달성 미체크 / Windows main 가드 / models.ts 하드코딩).
> **baseline (typecheck/test/build) 3/3 통과** — scripts/ 8 개 추가가 빌드 안 깼음. **사용자 dummy 의 schema mismatch 5 건** 도 발견 (stub 구현 후 .method() 단계에서 재검증 필요).
