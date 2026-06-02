# L1 Domain Spec

| | |
|---|---|
| Status | Draft |
| Last updated | 2026-05-18 |
| Supersedes | — |
| Depends on | `architecture.md` (Proposed) — 특히 D-1, D-5, D-7, D-8 |

이 문서는 OpenMath의 **도메인 개념**과 **불변식(invariants)** 을 정의한다.
"무엇이 *Problem* 인가, 무엇이 *Verification* 인가, 어떤 조건이 항상 참인가."
구체적 HTTP 계약은 이 문서가 아닌 L2 `contracts.md`(TBD)에서 다룬다.

---

## 1. 도메인 지도

```
                          ┌──────────────┐
                          │   Strategy   │  성취기준별 출제 룰
                          └──────┬───────┘
                                 │ governs
                                 ▼
   ┌──────────┐  retrieves   ┌───────────┐  produces   ┌──────────────────┐
   │ SourceProblem ├────────►│   Intent  │────────────►│ GeneratedProblem │
   └──────────┘              └───────────┘             └────────┬─────────┘
        ▲                                                       │
        │ matches                                                │ verified by
        │                                                        ▼
        │                                              ┌──────────────────┐
        └──────────────────────────────────────────────│   Verification   │
                                                       └──────────────────┘
```

`SourceProblem` (원본 정규화 문제) → `Intent` (의도) → `GeneratedProblem` (생성 후보) → `Verification` (검증 결과). `Strategy`는 모든 단계의 *규칙* 을 제공한다.

---

## 2. 핵심 도메인 개념

### 2.1 `SourceProblem` — 원본 정규화 문제

**의도**: AI Hub 3종 데이터셋(110/111/30)에서 정규화된 학습/검색용 문제. 코퍼스 단위.

**스키마**: `math-sample-unified-v1` (31 필드, `docs/PROGRESS.md` §2.3).

**핵심 필드**:
| 필드 | 타입 | 의미 |
|---|---|---|
| `item_id` | string | 고유 식별 |
| `source_dataset` | `"110" \| "111" \| "30"` | 출처 |
| `school_level` | `"middle" \| "high"` | 학교급 |
| `grade` | `1 \| 2 \| 3 \| null` | 학년 (고등 공통수학은 null) |
| `topic_code` | string | 성취기준 코드 (예: `9수XX-04`) |
| `topic_name` | string | 단원명 |
| `achievement_standard` | string | 성취기준 본문 |
| `question_text` | string (LaTeX) | 문제 본문 |
| `answer_text` | string (LaTeX) | 정답 |
| `explanation_text` | string \| null | 해설 |
| `problem_type_norm` | `"objective" \| "essay" \| "short_answer" \| "subjective"` | 유형 |
| `difficulty_norm` | `"easy" \| "medium" \| "hard"` | 난이도 |

**불변식**:
- (I-S1) `question_text`와 `answer_text`는 항상 비어있지 않다 (100% 완성, `PROGRESS.md` §2.5).
- (I-S2) `topic_code`가 있으면 그에 대응하는 `achievement_standard`가 반드시 존재한다.
- (I-S3) LaTeX 분수 표기는 `\frac`로 통일 (`\dfrac`, `\tfrac`, `\over` 금지).
- (I-S4) `source_dataset == "30"`인 일부 문항만 `explanation_text == null` 허용 (3건, `PROGRESS.md` §2.5).
- (I-S5) `school_level == "middle"`이면 `grade ∈ {1, 2, 3}` (null 불가).

---

### 2.2 `Intent` — 학습 의도

**의도**: 사용자 요청(또는 원본 문제)에서 추출한 *학습 목표* 와 *평가 차원*. 동형성 판단의 축.

**왜 도메인 개념인가**: `docs/product/USER_FLOW.md` §4의 OpenMath 핵심 차별점 — 동형 문제는 같은 `Intent`를 공유해야 한다.

**핵심 필드**:
| 필드 | 타입 | 의미 |
|---|---|---|
| `objective_code` | string | 성취기준 코드 (예: `9수04-12`) |
| `objective_description` | string | 학습 목표 자연어 |
| `evaluation_dimensions` | `EvaluationDimension[]` | 평가 차원 (가변길이, 보통 1-3개) |
| `required_techniques` | string[] | 사용해야 하는 기법 (예: "인수분해", "연립") |
| `forbidden_techniques` | string[] | 금지 기법 (예: "공식 직접 대입") |
| `surface_constraints` | `SurfaceConstraints` | 표현·형식 제약 (난이도·문제유형·답 형식) |

```ts
type EvaluationDimension = {
  id: string;             // e.g., "A", "B", "C"
  description: string;    // 예: "두 조건식에서 a₁과 d를 연립으로 구함"
  must_preserve: boolean; // 동형 변형 시 이 차원을 *보존* 해야 하는지
};

type SurfaceConstraints = {
  difficulty: "easy" | "medium" | "hard";
  problem_type: "objective" | "essay" | "short_answer" | "subjective";
  expected_choice_count?: number;  // objective일 때
};
```

**불변식**:
- (I-I1) `evaluation_dimensions.length ≥ 1` — 적어도 하나의 평가 차원이 식별돼야 한다.
- (I-I2) `must_preserve == true`인 차원이 ≥ 1 개 존재해야 한다. 모두 false면 동형 의미 없음.
- (I-I3) `objective_code`는 [9수XX-YY] 또는 [10공수XX-YY] 패턴을 만족.

---

### 2.3 `GeneratedProblem` — 생성된 후보 문제

**의도**: Generation Specialist가 만든 *후보*. 아직 검증되지 않음.

**핵심 필드**:
| 필드 | 타입 | 의미 |
|---|---|---|
| `candidate_id` | string (uuid) | 후보 식별 |
| `mode` | `"structural" \| "conceptual"` | 동형 모드 |
| `question_text` | string (LaTeX) | 생성된 문제 |
| `expected_answer` | string (LaTeX) | LLM이 제시한 정답 |
| `expected_choices?` | string[] | 객관식일 때 보기 |
| `proposed_solution_trace` | string | LLM이 제시한 풀이 과정 |
| `source_refs` | string[] | 참조한 `SourceProblem.item_id` 목록 |
| `inferred_intent` | Intent | 이 문제가 *겨냥하는* 의도 |
| `generation_metadata` | `GenerationMeta` | 생성 메타 (model, temperature, prompt version, attempt#) |

**불변식**:
- (I-G1) `inferred_intent.objective_code == request.intent.objective_code` — 학습 목표는 항상 동일.
- (I-G2) `mode == "structural"`이면 `inferred_intent.required_techniques`가 원본과 동일 (구조 동형 정의).
- (I-G3) `mode == "conceptual"`이면 `inferred_intent.evaluation_dimensions` 중 `must_preserve` 차원이 원본과 동일 (개념 동형 정의).
- (I-G4) 검증되지 않은 `GeneratedProblem`은 *사용 가능한 문항* 으로 노출되지 않는다 — verdict `"rejected"` 후보는 `result` 이벤트에 포함되되 FE의 `{component.result-card-failed}` (좌측 4px `{colors.fail}` border + `inline-notice-fail` + "채택" 비활성) 로 *시각 가드* 되어 학생 시험지 등 외부로 흘러가지 못함. *데이터 노출* 은 허용 (강사 신뢰 확보), *사용 노출* 은 차단 (D-1 원칙). 자세한 정책 결정은 architecture.md D-11.

---

### 2.4 `Verification` — 검증 결과

**의도**: 한 `GeneratedProblem`이 6단계 게이트를 어떻게 통과했는지 기록. **검증은 결정론** (D-1).

**핵심 필드**:
| 필드 | 타입 | 의미 |
|---|---|---|
| `candidate_id` | string | 검증 대상 |
| `overall` | `"verified" \| "rejected" \| "warning"` | 최종 판정 |
| `gates` | `GateResult[6]` | 6단계 각각의 결과 |
| `failure_reason?` | `HumanFailureReason` | rejected일 때 사람 언어 메시지 |
| `attempt_count` | number | 누적 재시도 회수 |

```ts
type GateResult = {
  step: "rag" | "intent" | "generate" | "sympy_verify" | "re_solve" | "objective_map";
  status: "passed" | "failed" | "skipped";
  duration_ms: number;
  evidence?: unknown;  // step별 다름
  failure_detail?: { code: string; message: string };
};

type HumanFailureReason = {
  category:
    | "arithmetic_error"        // SymPy에서 계산 불일치
    | "multiple_solutions"      // 답이 여러 개 (조건 부족)
    | "independent_resolve_mismatch"
    | "learning_objective_mismatch"
    | "structural_error";       // LaTeX 깨짐 등
  user_message_ko: string;      // "AI가 -2를 +2로 잘못 계산했습니다"
};
```

**불변식**:
- (I-V1) `gates`는 정확히 6개. 누락된 단계는 `status: "skipped"`로 명시.
- (I-V2) `overall == "verified"`는 `gates[3] (sympy_verify).status == "passed"` **and** `gates[5] (objective_map).status == "passed"` 일 때만 가능 (결정론 게이트).
- (I-V3) `gates[1] (intent)`와 `gates[2] (generate)`가 passed라도 `gates[3] (sympy_verify)`가 failed면 `overall != "verified"` (D-1: LLM은 정답 판단 X).
- (I-V4) `overall == "warning"`은 SymPy는 통과했으나 `independent_resolve`(gates[4])가 불일치할 때만 사용 — 사용자에게 *주의* 라벨로 노출.
- (I-V5) `attempt_count > 3`이면 강제 `overall == "rejected"` (Q-5 잠정 정책, D-9에서 확정 예정).

---

### 2.5 `Strategy` — 출제 전략

**의도**: 성취기준별로 *어떤 변형이 허용되는지* 정의한 YAML. [비할당] 팀원이 매일 만지는 토스 단위. `packages/agent/data/achievement-standards/*.yaml`.

**핵심 필드**:
```yaml
# data/achievement-standards/9수04-12.yaml
code: 9수04-12
title: 이차방정식의 풀이
school_level: middle
grade: 3
techniques:
  required_at_least_one_of:   # 이 중 하나는 반드시 사용
    - factoring
    - quadratic_formula
    - completing_the_square
  forbidden:
    - calculator_only

evaluation_dimensions:
  - id: A
    description: 인수분해 가능 형태 식별
    must_preserve: true       # 구조 동형 시 보존
  - id: B
    description: 근의 개수·중근 판별
    must_preserve: false      # 변형 가능

structural_transforms:        # 구조 동형 변형 룰
  - coefficient_swap: { range: [-10, 10], exclude_zero: true }
  - sign_flip: ok

conceptual_transforms:        # 개념 동형 변형 룰
  - rephrase_as_word_problem: { context: ["속력", "면적", "수열"] }
  - present_via_root_relations: { e.g., "두 근의 합·곱이 주어졌을 때" }
```

**불변식**:
- (I-T1) `code`는 [9수XX-YY] 또는 [10공수XX-YY] 패턴 만족.
- (I-T2) `evaluation_dimensions`에 `must_preserve: true`가 ≥ 1개.
- (I-T3) YAML 파일명은 `<code>.yaml` (1:1 매핑).
- (I-T4) Strategy 없는 성취기준은 `mode: "structural"`만 지원, `conceptual`은 불가 (안전한 기본값).

---

## 3. 두 동형 모드의 도메인 차이

[USER_FLOW.md §4](file:///../product/USER_FLOW.md) 차별점을 도메인 언어로 표현:

| | 구조적 동형 | 개념적 동형 |
|---|---|---|
| 보존 대상 | `required_techniques` 전체 | `evaluation_dimensions` 중 `must_preserve: true`만 |
| 변형 대상 | 계수, 부호, 항 번호 | 표현 양식, 진술 방향, 풀이 경로 |
| `GeneratedProblem.mode` | `"structural"` | `"conceptual"` |
| 검증 게이트 6 (objective_map) | 자동 통과 (techniques 일치 시) | 결정론 매칭 + LLM nuance 보조 |

---

## 4. 진행 중 / 미해결

- (D-9 예정) Verification retry 상한과 비용 가드 — 현재 `attempt_count ≤ 3` 잠정. Q-5 closure 시 D-9로 확정.
- `GenerationMeta.cost_estimate` 필드 — Q-5 closure 후 추가
- `User` / `Session` / `History` 도메인 — 1차 MVP scope out (D-3)
- LaTeX 구조 이상 (홀수 `$` 3건, 중괄호 불균형 44건) 처리 정책 — L1 책임인가, 데이터 정제 책임인가 결정 필요

---

## 5. 외부 참조 (객관적 사실)

- `docs/PROGRESS.md` §2 — `SourceProblem`의 `math-sample-unified-v1` 31필드 정의
- `docs/product/USER_FLOW.md` §4 — 동형 두 정의의 사용자 측 정의
- `docs/specs/architecture.md` D-1 — 검증은 결정론 (Verification 불변식 I-V2, I-V3의 근거)
- `docs/specs/architecture.md` D-5 — Specialist 구성 (Verification.gates 6개의 근거)
- `docs/specs/architecture.md` D-7 — `RagClient`가 `SourceProblem`을 반환
