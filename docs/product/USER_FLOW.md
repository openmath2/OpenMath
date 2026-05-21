# Product Spec — User Flow

| | |
|---|---|
| Status | Draft |
| Last updated | 2026-05-20 |
| Supersedes | — |
| Depends on | `packages/web/DESIGN.md` (alpha) · `docs/specs/architecture.md` (Proposed) · `docs/specs/domain.md` (Draft) |

이 문서는 OpenMath의 **사용자 흐름(user flow)** 을 정의한다.
"누가 어떤 화면에 진입하여, 무엇을 결정하고, 어떤 도메인 객체를 만들어내며,
다음 화면으로 어떻게 넘어가는가."
컴포넌트 토큰·색·간격은 이 문서가 아닌 `packages/web/DESIGN.md` 에서 다룬다.
도메인 객체의 스키마와 불변식은 `docs/specs/domain.md` 에서 다룬다.

---

## 1. Persona

### 1.1 1차 사용자 — 학원 수학 강사

| | |
|---|---|
| 직무 | 중학교 1~3학년 수학 출제 |
| 빈도 | 주 2~5회 (반별 보강·재시험·주간 과제) |
| 출제 단위 | 한 번에 3~10문항, 학년·단원 좁게 한정 |
| 출제 목적 | "이 학생이 푼 문제와 *같은 능력을 측정하는 다른 문제*" 가 필요함 |
| Pain | LLM 출력 그대로는 못 쓴다 — 답이 틀리거나, 풀이 경로가 어긋나거나, 학년 외 기법이 섞임 |
| 보유 도구 | 한글·MS Word 시험지 템플릿, 종이 출력 |
| 결정 기준 | "이 문제가 *원본과 같은 능력*을 측정하는가" + "*수학적으로 맞는가*" |

**MVP 인증 모델:** 로그인 없음. 강사 1인 = 브라우저 세션 1개 (`architecture.md` §1.3).

### 1.2 2차 사용자 — 학교 수학 교사

학원 강사용으로 설계된 흐름이 학교 교사의 출제 요구도 자동으로 충족한다. 근거는 §6.

### 1.3 부수 사용자 — 캡스톤 심사위원

데모 단계에서 "랜딩 진입 → 한 문제 생성 → 검증 통과 → PDF 출력"의 전 구간을 5분 안에 시연할 수 있어야 한다. 이 제약이 흐름의 깊이 한계를 규정한다 (모달·계정·복잡한 분기 없음).

---

## 2. 핵심 흐름 한눈에

```
                  ┌──────────────────────────────────────────┐
                  │   Editorial surface (warming ivory)      │
                  └──────────────────────────────────────────┘
                                    │
                              ┌─────┴─────┐
                              │  Landing  │  /
                              │  (히어로 + │
                              │   책 4권)  │
                              └─────┬─────┘
                                    │ 「무료로 시작하기」
                  ┌─────────────────┼─────────────────────────┐
                  │                 ▼                         │
                  │   Productivity surface (pure white)       │
                  │                                           │
                  │   ┌───────┐   ┌───────┐   ┌───────┐       │
                  │   │  S0   │──▶│ S1~S2 │──▶│  S3   │       │
                  │   │ Work  │   │ 학년/ │   │ 동형 +│       │
                  │   │ space │   │ 단원  │   │ 평가  │       │
                  │   └───────┘   └───────┘   └───┬───┘       │
                  │                               │           │
                  │   ┌───────┐   ┌───────┐   ┌───▼───┐       │
                  │   │  S6   │◀──│  S5   │◀──│  S4   │       │
                  │   │  PDF  │   │ 결과/ │   │ 검증  │       │
                  │   │  출력 │   │ 수정  │   │ 6단계 │       │
                  │   └───────┘   └───────┘   └───────┘       │
                  └───────────────────────────────────────────┘
```

흐름의 단방향 진행은 깰 수 없는 원칙이 아니다 — sub-nav 의 breadcrumb 으로 이전 단계 재진입은 항상 가능하다. 단, S4 (검증 진행) 는 진행 중에는 뒤로갈 수 없다 (`agent` 의 SSE 스트림 중단 = 진행 폐기).

각 단계의 surface 결정과 토큰 매핑은 `DESIGN.md` §"Surfaces" 를 그대로 따른다.

---

## 3. 단계별 흐름

각 단계는 다음 형식으로 명세한다:

| 항목 | 의미 |
|---|---|
| 목적 | 사용자가 이 화면에서 해결해야 하는 단 하나의 결정 |
| 진입 조건 | 이 화면에 도달하기 위해 충족되어야 하는 상태 |
| 화면 구성 | `DESIGN.md` 컴포넌트 어휘로 본 레이아웃 |
| 사용자 액션 | 화면이 받아들이는 입력 |
| 산출 | 흐름이 만들어내는 도메인 객체 (`domain.md` 참조) |
| 다음 단계 | 액션 결과별 분기 |

---

### 3.0 Landing — `/`

| | |
|---|---|
| 목적 | "검증된 동형 문제 한 세트를 만든다" 는 가치 제안을 전달하고 워크스페이스로 진입시킨다 |
| 진입 조건 | URL `/` 직접 진입 또는 외부 링크 |
| 화면 구성 | `eyebrow` + `display-hero` (Fraunces 96~104px) + 좌측 텍스트 / 우측 `book-cover` × 4 + `floating-token` + `button-primary` "무료로 시작하기" + `feature-cell` × 3~4 + `footline` |
| 사용자 액션 | `button-primary` 클릭 / `book-cover` 호버로 책 표지 펼침 (parallax) |
| 산출 | 없음 (편집적 surface) |
| 다음 단계 | → S0 (`/app`) |

**Surface:** Editorial. `{colors.canvas}` 워밍 아이보리 + Fraunces 디스플레이 + 책 스택. 페이지 어디에도 사진 없음 — 책 4권과 떠다니는 수식 토큰이 사진의 자리를 대신함.

**Voice:** "수학 문제는 그럴듯해서는 안 된다. *맞아야 한다.*"

**한 viewport 규칙:** 같은 fold 에 `button-primary` 와 `button-ghost` "샘플 문제 보기" 두 가지만. 다른 어떤 primary 컬러 chrome 도 등장 X (`DESIGN.md` Do's §7).

---

### 3.1 S0 — Workspace — `/app`

| | |
|---|---|
| 목적 | "새 문제 한 세트를 시작한다" — 단일 진입점 |
| 진입 조건 | 랜딩에서 진입, 또는 `/app` 북마크 |
| 화면 구성 | `primary-nav` (brand-mark + nav-links + `button-primary` "문제 생성하기 →") + `hero-tile-productivity` (`{colors.ink}` 배경, Fraunces 72px on-ink) + `job-entry-card` 2-up (S0-A "새 문제 만들기" / S0-B "이 문제처럼 — OCR 입력") |
| 사용자 액션 | `job-entry-card` 클릭 |
| 산출 | 새 `WorkSession` (브라우저 세션 단위, 영속 X — MVP) |
| 다음 단계 | S0-A 선택 → S1 / S0-B 선택 → (MVP disabled, hint pill 만 노출) |

**Surface:** Productivity. `{colors.canvas-pure}` 순백. 모든 카드는 zero radius / zero shadow / 1px `{colors.hairline-soft}`.

**MVP 제약:** S0-B "이 문제처럼" 은 disabled state 만 노출. textarea-multiline 외 이미지 업로드 컴포넌트는 `DESIGN.md` Known Gaps §"OCR 입력" 에서 보류. 캡스톤 데모에서는 S0-A 만 사용.

---

### 3.2 S1 — 학년 선택 — `/app/new/grade`

| | |
|---|---|
| 목적 | 출제 대상의 *학교급 + 학년* 을 결정 |
| 진입 조건 | S0 에서 "새 문제 만들기" 클릭 |
| 화면 구성 | `sub-nav` ("← 워크스페이스 / 새 문제 만들기 · (1/4)") + `heading-xl` "어느 학년인가요?" + `intent-radio-card` 3-up ("중1" / "중2" / "중3") + `action-bar-sticky` (좌: `button-secondary` "취소" / 우: `button-primary` "다음 →") |
| 사용자 액션 | `intent-radio-card` 1개 선택 → `button-primary` "다음" |
| 산출 | `Intent.surface_constraints.grade` 부분 채움 |
| 다음 단계 | → S2 |

**불변식:** 학교급은 MVP 단계에서 `middle` 로 고정 (`architecture.md` §1.1). 따라서 학년만 결정. 고등 진입은 v2.

**한 fold 규칙:** `button-primary` 는 sticky action-bar 안 한 곳만. radio card 자체는 `intent-radio-card-active` (border 2px ink) 으로 선택 표현 — primary blue 가 사용되지 않음.

---

### 3.3 S2 — 단원 선택 — `/app/new/topic`

| | |
|---|---|
| 목적 | 학년 안에서 *성취기준 단원* 1개를 결정 |
| 진입 조건 | S1 에서 학년 결정 완료 |
| 화면 구성 | `sub-nav` ("← 학년 선택 · (2/4)") + `heading-xl` "어느 단원인가요?" + `filter-chip` row (대단원 필터) + `intent-radio-card` 그리드 (소단원 — 성취기준 단위, 1열 또는 2열) + 각 카드에 `meta-pill` (성취기준 코드 e.g. `9수04-12`) + `action-bar-sticky` |
| 사용자 액션 | `filter-chip` 으로 대단원 좁히기 → `intent-radio-card` 1개 선택 → "다음 →" |
| 산출 | `Intent.objective_code` + `Intent.objective_description` 결정 |
| 다음 단계 | → S3 |

**도메인 매핑:** 선택된 단원의 `topic_code` 가 `domain.md` §2.1 의 `SourceProblem.topic_code` 와 매칭되어, S4 의 RAG 검색 (1/6 단계) 의 검색 키가 된다.

**MVP 제약:** 단원 카드 목록은 2022 개정 교육과정 기준 정적 데이터. 백엔드 호출 없음.

---

### 3.4 S3 — 동형 모드 + 평가 차원 — `/app/new/intent`

| | |
|---|---|
| 목적 | "어떻게 동형으로 만들 것인가" 와 "원본의 어떤 능력을 *보존* 할 것인가" 를 결정 |
| 진입 조건 | S2 에서 단원 결정 완료 |
| 화면 구성 | `sub-nav` ("← 단원 선택 · (3/4) 의도 확인") + 두 sub-section 으로 분할 |

**S3-A — 동형 모드 선택**

| | |
|---|---|
| 컴포넌트 | `heading-md` "어떤 동형으로 생성할까요?" + `intent-radio-card` 2개 |
| 옵션 1 | **구조 동형 (Structural)** — 숫자·계수만 바꿔 같은 풀이 경로. `badge-pass` ✓ 구조동형 |
| 옵션 2 | **개념 동형 (Conceptual)** — 풀이 경로는 달라도 같은 학습 목표·평가 차원. `badge-concept` ✦ 개념동형 |

**S3-B — 평가 차원 체크**

| | |
|---|---|
| 컴포넌트 | `heading-md` "보존해야 하는 능력은?" + `intent-checkbox` 다중선택 (보통 2~5개) |
| 항목 형식 | `[키 코드]` + 본문 (e.g. `[A]` "두 조건식에서 a₁과 d를 연립으로 구함") |
| 기본 선택 | 단원의 성취기준에서 자동 후보 추출, 1개 이상 강제 (`button-primary` disabled) |
| 비고 | `inline-notice-warn` "이 차원을 *보존* 해야 동형으로 인정됩니다" |

| | |
|---|---|
| 사용자 액션 | radio 1개 + checkbox 1개 이상 → "생성하기 →" |
| 산출 | 완성된 `Intent` 객체 (`domain.md` §2.2). `evaluation_dimensions` 의 `must_preserve = true` 채워짐. 동형 모드는 `Intent` 외부의 메타로 전달 (`agent` 의 generation strategy 파라미터) |
| 다음 단계 | → S4 (검증 진행) |

**중요:** S3 의 결정이 OpenMath 의 *핵심 차별점* 을 만든다 — §4 참조.

---

### 3.5 S4 — 검증 진행 — `/app/new/verify`

| | |
|---|---|
| 목적 | 생성·검증 6단계의 실시간 진행을 사용자에게 노출 (블랙박스 X) |
| 진입 조건 | S3 에서 `Intent` + 동형 모드 결정 완료, "생성하기" 클릭 |
| 화면 구성 | `sub-nav` ("← 의도 확인 · (4/4) 검증 진행") + `heading-xl` "검증하고 있습니다" + `step-progress-row` × 6 + `formula-stage` 1개 (생성된 첫 후보 문항 미리보기, 3/6 단계 완료부터 노출) + `action-bar-sticky` (`button-secondary` "취소"만, primary 비노출) |
| 사용자 액션 | 대기 (5~30초). "취소" 클릭 시 SSE 스트림 중단 → S3 복귀 |
| 산출 | `Verification` 객체 (모든 단계 통과 시) 또는 부분 통과 `Verification` |
| 다음 단계 | 6단계 모두 pass → S5 / 1개 이상 fail → S5 (실패 카드로 진입) |

**6단계 (`step-progress-row` 의 행 순서):**

| Step | 이름 | pass 시그널 | fail 시 |
|---|---|---|---|
| 1/6 | RAG 검색 | "✓ 12개 참조 발견" | retry 1회, 그래도 0건이면 S3 복귀 + `inline-notice-warn` |
| 2/6 | 의도 추출 | "✓ 학습 목표 · 핵심 제약" | S3 복귀 |
| 3/6 | 문제 생성 | "✓ 3개 후보" | LLM 호출 실패 — 재시도 안내 |
| 4/6 | 산술 검증 (SymPy) | "✓ 모두 일치" | 잘못된 후보 폐기, 5/6 으로 계속 |
| 5/6 | 독립 재풀이 | "✓ 답 재현" | 후보 폐기 |
| 6/6 | 학습 목표 매핑 | "✓ A·B·C 보존" | `badge-warn` 부분 통과로 표기, S5 로 진행 |

**State machine:**
- 행 상태 4가지 (`DESIGN.md` step-progress-row 명세): `-pending` (·, ink-4) → `-active` (spinner-dot + border-left 3px ink) → `-pass` (pass-deep) 또는 `-fail` (fail-deep).
- 한 시점에 `-active` 행은 정확히 1개.

**SSE 스트림 컨트랙트:** `agent` 가 step 별 `event: step.complete` 를 push. 클라이언트는 해당 row 의 state 만 갱신. 끊기면 `action-bar-sticky` 에 `inline-notice-fail` 노출.

**중요:** 이 화면은 "AI 가 뭔가 하고 있다" 가 아니라 "어떤 검증을 통과하고 있다" 를 보여준다. progress 가 가짜 spinner 가 아니라 *결정론적 6단계* 임을 사용자가 알 수 있어야 함.

---

### 3.6 S5 — 결과 확인 + 수정 — `/app/new/result`

| | |
|---|---|
| 목적 | 검증 통과한 문항을 사용자가 *최종 채택* 또는 *수정* — 출제는 사람의 결정 |
| 진입 조건 | S4 의 6단계 완료 (전부 pass 또는 일부 warn) |
| 화면 구성 | `sub-nav` ("← 검증 진행 / 결과") + `heading-xl` "3개 문항이 준비되었습니다" + `filter-chip` row ("전체" / "구조동형" / "개념동형" / "주의") + `result-card` 그리드 3-up |
| `result-card` 내부 | 1. `card-head` (문항 번호 + `badge-*` + 아이콘 클러스터 [즐겨찾기·재생성·수정]) → 2. `formula-stage` (LaTeX 문제 본문) → 3. `meta` (정답 + `disclosure-row` "풀이 보기" + secondary 액션) |
| 실패 카드 | `result-card-failed` — 4px left border `{colors.fail}` + `inline-notice-fail` "독립 재풀이에서 답 불일치 — 검토 필요" 한 줄 |
| 부분 통과 카드 | `result-card` + `badge-warn` + `inline-notice-warn` "평가 차원 C 미보존 — 채택 시 학습 목표가 어긋날 수 있습니다" |
| 사용자 액션 | 카드별 [채택 / 재생성 / 수정 / 폐기] · `action-bar-sticky` (좌: `button-secondary` "다시 검증" / 우: `button-ink` "PDF 만들기 →") |
| 산출 | 채택된 `GeneratedProblem[]` (`domain.md` §2.3) |
| 다음 단계 | → S6 |

**수정 모드:** 카드의 "수정" 아이콘 클릭 시 `formula-stage` 가 inline editor 로 전환 (textarea + KaTeX preview). 저장 시 해당 카드만 4/6·5/6 단계 재검증 (full pipeline 아님).

**왜 `button-ink` 인가:** S5 → S6 는 흐름의 *결정적 다음* 이지만, S5 에서 primary blue 가 이미 result-card 안 여러 곳 (badge-concept 배경, 채택 indicator) 에 등장하므로, action-bar 의 강조 액션은 `{colors.ink}` 로 중화 (`DESIGN.md` Iteration Guide §7).

---

### 3.7 S6 — PDF 출력 — `/app/new/export`

| | |
|---|---|
| 목적 | 채택된 문항 세트를 시험지 PDF 로 변환 |
| 진입 조건 | S5 에서 1개 이상 채택, "PDF 만들기" 클릭 |
| 화면 구성 | `sub-nav` ("← 결과 / PDF 출력") + `heading-xl` "시험지 미리보기" + 좌 60%: `pdf-preview-thumbnail` (A4 1:1.41 비율, 헤더 + 문항 1~3 mini-render) + 우 40%: 옵션 패널 (`disclosure-row` × N — 제목·날짜·정답표 포함 여부·문항 순서 셔플) + `action-bar-sticky` (좌: `button-secondary` "결과로" / 우: `button-primary` "PDF 다운로드 ↓") |
| 사용자 액션 | 옵션 토글 → "PDF 다운로드" |
| 산출 | A4 PDF 파일 (브라우저 다운로드, 영속 X) |
| 다음 단계 | → 다운로드 완료 후 `inline-notice-pass` "PDF 가 다운로드되었습니다" → 동일 화면 잔류. 사용자가 sub-nav 로 S0 복귀하거나 새 세션 시작. |

**MVP 제약:** PDF 렌더링은 클라이언트 사이드 KaTeX → HTML → 브라우저 print API 또는 jsPDF. 서버 사이드 PDF 생성 (한글 폰트 임베드 포함) 은 v2.

**왜 모달 없는 풀-페이지인가:** `DESIGN.md` Known Gaps §"모달 / 다이얼로그" — 1차 MVP 는 풀-페이지 전환만, 모달 없음.

---

## 4. 핵심 차별점 — 동형 + 검증

OpenMath 의 사용자 흐름이 일반 "AI 출제 도구" 와 다른 점은 두 가지다.

### 4.1 동형은 우연이 아니라 *명세*

S3 에서 사용자가 `Intent` 의 `evaluation_dimensions` 를 명시적으로 체크박스로 선택한다. 이 선택은 단순한 메타데이터가 아니라 *판정 기준* — `domain.md` §2.2 의 정의에 따라:

> 동형 문제는 같은 `Intent` 를 공유해야 한다.

따라서 S6 단계에서 "이 문제 두 개는 동형인가" 라는 질문에 OpenMath 는 *결정적으로* 답할 수 있다. 두 문제의 `Intent.evaluation_dimensions` 의 `must_preserve = true` 항목 집합이 같으면 동형, 다르면 동형 아님.

S5 의 `badge-concept` / `badge-pass` 분리도 여기서 나온다 — 구조 동형은 풀이 경로까지 같고, 개념 동형은 풀이 경로는 달라도 평가 차원이 같다.

### 4.2 검증은 LLM 이 아니라 *기호 계산*

S4 의 4/6 (산술 검증, SymPy) 와 5/6 (독립 재풀이) 는 LLM 출력의 자기-평가가 아니다. `math-engine` 의 결정론적 계산이다 (`architecture.md` §3.1: "agent 는 수학 계산을 직접 하지 않는다").

따라서 사용자가 S5 의 `result-card` 헤더에서 보는 `badge-pass` ✓ 는 LLM 의 "자신감" 이 아니라, 독립된 기호 계산 시스템이 "이 답이 맞다" 고 증명한 결과다.

이 두 가지가 흐름 전체의 신뢰 근거다. 화면 디자인 (검증 시그널 컬러의 의미 한정 사용, `DESIGN.md` Don'ts §"검증 시그널 색을 분위기용으로 사용 금지") 도 이 신뢰를 시각적으로 받쳐주기 위해 짜여졌다.

---

## 5. 에러 · 예외 흐름

### 5.1 SSE 스트림 끊김 (S4)

| 시점 | 처리 |
|---|---|
| 1/6 직전 | `inline-notice-fail` "연결이 끊겼습니다 — 다시 시도" + `button-primary` "다시 시작" → S3 의 "생성하기" 와 동일 |
| 2/6 ~ 5/6 진행 중 | 현재 step 까지의 부분 결과 폐기. `inline-notice-fail` 노출 후 S3 복귀 |
| 6/6 진행 중 | 5/6 까지의 결과는 보존. `badge-warn` 으로 학습 목표 매핑 미확인 표기하여 S5 로 진행 |

### 5.2 검증 0/6 통과 (S4 → S5)

`result-card-failed` 만 노출되는 S5. `action-bar-sticky` 우측은 `button-primary` "PDF 만들기" 가 아닌 `button-secondary` "다시 검증" 한 개만. PDF 출력 차단.

### 5.3 사용자가 흐름 중간에 이탈

MVP 는 세션 영속 X. 탭 닫기 = 모든 상태 폐기. `inline-notice-warn` 등 사전 경고 없음 — 첫 시연에서 단순함을 우선.

캡스톤 이후 v2 에서는 `WorkSession` 의 localStorage persist + S5 의 "복구" 카드 도입 고려.

### 5.4 학년 외 기법 (예: 중1 문제에 인수분해 등장)

S4 의 6/6 (학습 목표 매핑) 가 catch. `Intent.forbidden_techniques` 에 학년 외 기법이 자동 채워지므로, 6/6 의 fail 사유가 `badge-warn` 으로 노출된다 — "중1 단원에서 인수분해 사용 — 학습 목표 외".

---

## 6. 2차 사용자 (학교 교사) 자동 충족

`architecture.md` §1.3 은 학교 교사를 2차 사용자로 두고 본 문서 §6 의 자동 충족을 참조한다.

학원 강사 흐름이 학교 교사 흐름을 자동으로 포함하는 근거:

| 요구 | 학원 강사 | 학교 교사 | 본 흐름의 충족 |
|---|---|---|---|
| 학년 단위 출제 | ✓ (반별) | ✓ (학급별) | S1 (학년 선택) |
| 성취기준 매핑 | △ (선택적) | ✓ (필수, 평가 근거) | S2 의 `meta-pill` 성취기준 코드 노출 |
| 평가 차원 명시 | △ (보강 목적) | ✓ (수행평가 기준표) | S3-B 의 `intent-checkbox` |
| 검증 신뢰성 | ✓ (학부모 클레임 방지) | ✓ (정오답 시비 방지) | S4 의 6단계 노출 |
| 종이 출력 | ✓ (학원 시험지) | ✓ (학교 시험지) | S6 의 PDF |
| 다인 협업 | — | △ (교과협의회) | **미충족 — v2** |
| 학교 LMS 연동 | — | △ | **미충족 — v2** |

5/7 항목이 1차 흐름으로 즉시 충족. 2/7 (협업·LMS) 는 v2 로 보류하되, S5 의 `result-card` 가 zero radius / hairline border / formula-stage 의 정렬된 형태를 갖는 것은 협업 단계에서 카드를 *외부로 공유* 하기 좋게 만든다 (스크린샷·복사 친화). 따라서 v2 진입 시 카드 자체 디자인은 그대로 재사용 가능.

---

## 7. URL 맵

| 단계 | URL | 비고 |
|---|---|---|
| Landing | `/` | editorial surface |
| S0 Workspace | `/app` | productivity 진입 |
| S1 학년 | `/app/new/grade` | (1/4) |
| S2 단원 | `/app/new/topic` | (2/4) |
| S3 의도 | `/app/new/intent` | (3/4) |
| S4 검증 | `/app/new/verify` | (4/4) — SSE 활성 |
| S5 결과 | `/app/new/result` | progress 표기 없음 |
| S6 PDF | `/app/new/export` | progress 표기 없음 |

`/app/new/*` 의 step 카운터 `(N/4)` 는 S1~S4 만 표기. S5·S6 는 흐름의 *완성 이후 단계* 이므로 카운터를 떼고 sub-nav 좌측 breadcrumb 만 노출 (`DESIGN.md` sub-nav 명세).

새 흐름 instance 단위로 URL 을 분리하지 않음 (`/app/new/{sessionId}/...` 같은 형태 X) — MVP 는 단일 세션이므로.

---

## 8. Known Gaps

- **OCR 입력 (S0-B "이 문제처럼"):** disabled. 이미지 → LaTeX 추출 컴포넌트 미정의. `DESIGN.md` Known Gaps §"OCR 입력" 과 동일 사유.
- **세션 영속:** 탭 닫기 = 폐기. v2 에서 localStorage 또는 계정 도입 후 결정.
- **모달:** 1차 MVP 풀-페이지 전환만. PDF 확정·재검증 확인 등도 모달 없이 처리.
- **다중 강사 협업:** 1인 단일 세션. 카드 공유 / 댓글 / 승인 흐름 모두 v2.
- **Mobile drawer:** `DESIGN.md` Known Gaps 와 동일. 1차 MVP 의 mobile 흐름은 sub-nav 와 action-bar-sticky 만 유효, primary-nav 의 nav-links 는 숨김.
- **접근성 (`prefers-reduced-motion`):** S4 의 spinner-dot, 랜딩의 책 표지 parallax 가 reduced-motion 시 정적 표현으로 fallback 필요. 본 문서 작성 시점 미구현.
- **계정 / 사용 이력:** 없음. 동일 강사가 어제 만든 문항 세트를 오늘 다시 볼 수 없다. v2.

---

## 9. Open Questions

- **Q-U1.** S3-A "동형 모드" 를 두 옵션 중 선택이 아닌 *둘 다 자동 시도 후 사용자가 결과에서 고르기* 로 바꾸는 안이 있다 — 그러면 S3 가 단순해지나 S4 의 생성 비용이 2배가 된다. 캡스톤 데모 후 사용자 인터뷰로 결정.
- **Q-U2.** S5 의 "수정" 모드에서 부분 재검증 (4/6·5/6 만) 이 사용자 신뢰를 깨지 않는가? 전체 재검증 vs 부분 재검증의 trade-off.
- **Q-U3.** S6 에서 정답표를 PDF 같은 파일에 둘지, 별도 파일로 분리할지. 학원 강사 인터뷰 필요.
- **Q-U4.** S0-B (OCR) 도입 시 흐름이 S0-B → S2 (학년/단원은 OCR 결과에서 자동 추론) → S3 로 단축되는가? 단축되면 S1 의 존재 의의는?

---
