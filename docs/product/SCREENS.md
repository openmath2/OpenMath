# Product Spec — Screens

| | |
|---|---|
| Status | Draft |
| Last updated | 2026-05-20 |
| Supersedes | — |
| Depends on | `docs/product/USER_FLOW.md` (Draft) · `packages/web/DESIGN.md` (alpha) · `docs/specs/domain.md` (Draft) |

이 문서는 OpenMath 의 **개별 화면(screen)** 을 정의한다.
"이 화면은 어떤 컴포넌트로 구성되고, 어떤 상태를 가지며, 어떤 데이터를 받고/내며,
키보드·스크린리더 사용자에게 어떻게 노출되는가."
화면 간 흐름·분기는 본 문서가 아닌 [USER_FLOW.md](./USER_FLOW.md) 에서 다룬다.
컴포넌트의 시각 토큰(색·간격·타이포)은 [DESIGN.md](../../packages/web/DESIGN.md) 에서 다룬다.

각 화면은 다음 4개 섹션으로 명세:
- **화면 구성요소** — 위에서 아래·왼쪽에서 오른쪽 순서. `DESIGN.md` 컴포넌트 토큰 참조.
- **상태 목록** — 화면 전체 또는 핵심 컴포넌트가 가질 수 있는 모든 visual/logical state.
- **데이터** — 화면이 *받는* 입력 (URL param·세션·서버) 과 *남기는* 출력 (도메인 객체·URL 전이).
- **접근성** — 키보드 조작, 스크린리더 노출, motion·contrast 고려.

공통 접근성 베이스라인 (모든 화면 적용, 화면별 섹션은 *추가* 사항만 기재):
- 모든 인터랙티브 요소 `tabindex` 진입 가능, focus indicator 가시.
- 한국어 본문 `lang="ko"`, `word-break: keep-all; overflow-wrap: break-word;`.
- 검증 시그널은 색 + 아이콘 + 텍스트 3중 표기 (색맹 사용자 대응, `DESIGN.md` Don'ts §"검증 시그널 색을 분위기용으로 사용 금지" 와 짝).
- 터치 타깃 WCAG AAA 44×44px (`DESIGN.md` Responsive §"Touch Targets").
- `prefers-reduced-motion: reduce` 시 모든 transform·parallax·spinner 회전 무효화.
- 본문 대비 WCAG AA 이상 (`{colors.ink}` on `{colors.canvas-pure}` ≈ 16:1, `{colors.ink-3}` on `{colors.canvas-pure}` ≈ 5.1:1).

---

## Landing — 랜딩

**URL:** `/`
**Surface:** Editorial (`{colors.canvas}` 워밍 아이보리)

### 화면 구성요소

| 영역 | 컴포넌트 | 비고 |
|---|---|---|
| Top utility | `{component.utility-bar}` | 우측 "도움말 · 피드백" 두 링크만 (MVP) |
| Primary nav | `{component.primary-nav}` | `{component.brand-mark}` + wordmark + nav-links 4개 + `{component.button-primary}` "문제 생성하기 →" |
| Hero — eyebrow | `{component.eyebrow}` | "검증된 문제 한 세트" — `{typography.caption-sm}` Mono |
| Hero — headline | `{typography.display-hero}` | Fraunces clamp(48,8vw,104)px — 1 페이지 1회 |
| Hero — meta row | `{component.meta-pill}` × N | "· 회원가입 X" / "· 중1–중3 전 단원" |
| Hero — CTA cluster | `{component.button-primary}` "무료로 시작하기" + `{component.button-ghost}` "샘플 문제 보기" | 같은 fold |
| Hero — book stack | `{component.book-cover}` × 4 | 380×500, perspective 1800px / rotateX 28° |
| Hero — floating tokens | `{component.floating-token}` × 6 (desktop) / 3 (mobile) | 수식·식별자, parallax |
| Hero — hint | `{component.hint-pill}` | "마우스를 올리면 표지가 넘어갑니다" — mouse-in 시 fade |
| Feature strip | `{component.feature-cell}` × 3 | num caption → heading-xl → body-sm |
| Footline | `{component.footline}` | copyright · build version |

**Effect 허용 (editorial 한정):** backdrop-blur, radial-gradient wash (`{colors.primary-50}` 우상단 + `{colors.pass-50}` 좌하단), 64×64 grid pattern overlay (4% opacity, radial mask fade), perspective transform, drop-shadow (책 표지 + brand-mark glow 단 2곳).

### 상태 목록

| 상태 | 트리거 | 표현 |
|---|---|---|
| Default | 페이지 로드 | 책 4권 닫힌 상태, floating-token 정지 |
| Hover-stage | 마우스가 book-stack 영역 진입 | `hint-pill` opacity → 0, 가장 가까운 book-cover 가 168° flip |
| Parallax-active | 마우스 이동 | floating-token data-depth 별 translate (-40px ~ -24px) |
| Reduced-motion | `prefers-reduced-motion: reduce` | 책 flip / parallax 모두 비활성, 정적 표시 |
| Mobile (<600px) | viewport | display-hero clamp → 48px, primary-nav links 숨김, book-stack 92vw, floating-token 3개로 축소 |

`{component.button-primary}` 자체의 상태는 default / `button-primary-active` (pressed: bg `{colors.primary-deep}` + `translateY(-1px)`) 두 가지.

### 데이터

| 항목 | 방향 | 값 |
|---|---|---|
| 입력 | — | 없음 (정적 페이지) |
| 클라이언트 상태 | — | 없음 (세션 미생성) |
| 출력 (CTA) | 라우팅 | `/app` 으로 전이 |
| 출력 (nav-links) | 라우팅 | 외부 문서 페이지 (MVP 단계 placeholder 가능) |

### 접근성

- **키보드:** `Tab` 순서 — utility links → primary-nav links → `button-primary` (nav) → eyebrow (skip) → hero CTA cluster → feature-cell links → footline. `Enter` 로 CTA 활성.
- **스크린리더:**
  - `display-hero` 는 `<h1>` 1개로 한정. feature-cell 의 num caption ("01", "02") 은 `aria-hidden="true"` (장식).
  - `book-cover` × 4 는 `role="img"` + `aria-label` "중1 인수분해 · 검증 12문항" 형식의 의미적 라벨. 책 표지 안 문구를 그대로 읽지 않게.
  - `floating-token` 은 `aria-hidden="true"` (장식 — 수식이 의미 운반 아님).
  - `hint-pill` 은 `aria-hidden="true"` 가 아니라 정보 — "마우스 사용자 안내" 의미는 마우스가 없는 사용자에게 노출되지 않아야 하므로 `<noscript>` 또는 hover-detection 직후에만 DOM 삽입.
- **Motion:** 책 flip / parallax 는 `prefers-reduced-motion` 시 무효 (`DESIGN.md` Known Gaps §"랜딩 book-stack 모션 접근성").

---

## S0 — Workspace

**URL:** `/app`
**Surface:** Productivity (`{colors.canvas-pure}` 순백)

### 화면 구성요소

| 영역 | 컴포넌트 | 비고 |
|---|---|---|
| Primary nav | `{component.primary-nav}` | brand-mark + nav-links + `button-primary` "문제 생성하기 →" (page-local 이중성 허용 — hero-tile 안 CTA 와 같은 동작) |
| Hero tile | `{component.hero-tile-productivity}` | `{colors.ink}` 배경, `{typography.display-section}` Fraunces 72px on-ink, 24×24 grid pattern overlay (white 4%) |
| Entry grid | `{component.job-entry-card}` × 2 (2-up → 768px↓ 1-up) | S0-A "새 문제 만들기" / S0-B "이 문제처럼 (OCR)" |
| S0-A card | `{component.job-entry-card}` | heading-lg "새 문제 만들기" + body-md 설명 + body-sm bullet list + `{component.button-primary}` "시작하기 →" |
| S0-B card | `{component.job-entry-card}` (disabled) | 동일 레이아웃 + `{component.badge-warn}` "준비 중" + CTA 비활성 |
| Footer | `{component.footer}` | 4-col 소개·도움말·캡스톤·피드백 + fine-print row |

### 상태 목록

| 카드 상태 | 표현 |
|---|---|
| Default | bg `{colors.canvas-pure}`, 1px `{colors.hairline-soft}` |
| Active (focus / hover) | `{component.job-entry-card-active}` — bg `{colors.soft-cloud}`, border `{colors.ink}` |
| Disabled (S0-B MVP) | opacity 1.0 유지, CTA 만 `aria-disabled="true"` + `{colors.ink-4}` text. 카드 전체 클릭 비활성 |
| Pressed | `button-primary-active` 만 (카드 자체는 pressed 상태 없음) |

### 데이터

| 항목 | 방향 | 값 |
|---|---|---|
| 입력 | URL | 없음 |
| 입력 | 세션 | 없음 (MVP 무영속) |
| 클라이언트 상태 | 생성 | `WorkSession` 인스턴스 (브라우저 세션) |
| 출력 (S0-A) | 라우팅 | `/app/new/grade` |
| 출력 (S0-B) | 라우팅 | (MVP) 라우팅 없음 |

### 접근성

- **키보드:** primary-nav `Tab` 진입 후 hero-tile 안 헤드라인은 skip (heading), S0-A 카드 `Tab` 진입 → `Enter` 로 카드 클릭과 동일 동작. S0-B 는 `tabindex="-1"` 또는 카드는 진입 가능하되 CTA 만 disabled 표기 (둘 다 가능, 권장: 카드 진입 + CTA disabled 로 정보 노출).
- **스크린리더:**
  - hero-tile headline `<h1>`. card title `<h2>`.
  - S0-B 카드는 `aria-disabled="true"` + visually-hidden 안내 "준비 중 — 캡스톤 데모 단계에서 비활성".
  - `job-entry-card` 전체를 하나의 링크 (`<a>`) 로 마크업 — 카드 내부 CTA 와 중복 클릭 영역이지만 스크린리더 사용자에게는 카드가 곧 링크여야 자연스러움.

---

## S1 — 학년 선택

**URL:** `/app/new/grade`
**Surface:** Productivity

### 화면 구성요소

| 영역 | 컴포넌트 | 비고 |
|---|---|---|
| Primary nav | `{component.primary-nav}` | 동일 |
| Sub nav | `{component.sub-nav}` | 좌: "← 워크스페이스 / 새 문제 만들기" · 우: "(1/4)" |
| Page title | `{typography.heading-xl}` | "어느 학년인가요?" |
| Helper text | `{typography.body-md}` `{colors.ink-3}` | "이번 출제의 대상 학년을 고르세요." |
| Choice grid | `{component.intent-radio-card}` × 3 (1-up 또는 3-up grid) | "중1" / "중2" / "중3" |
| Action bar | `{component.action-bar-sticky}` | 좌: `{component.button-secondary}` "취소" / 우: `{component.button-primary}` "다음 →" |

### 상태 목록

`intent-radio-card`:

| 상태 | 표현 |
|---|---|
| Default | bg `{colors.canvas-pure}`, 1px `{colors.hairline}`, dot indicator hollow |
| Focused | focus-ring 2px `{colors.primary}` outline (border 자체는 default 유지) |
| Active (선택) | `{component.intent-radio-card-active}` — bg `{colors.soft-cloud}`, border 2px `{colors.ink}`, dot indicator filled `{colors.ink}` |

페이지 단위:

| 상태 | 트리거 | `button-primary` |
|---|---|---|
| Empty | 진입 직후 | disabled |
| Selected | 카드 1개 선택 | enabled |
| Submitting | "다음 →" 클릭 후 라우팅 직전 | `spinner-dot` (보통 < 100ms 라 안 보임) |

### 데이터

| 항목 | 방향 | 값 |
|---|---|---|
| 입력 | URL | 없음 |
| 입력 | 세션 | (있다면) 이전 선택값 prefill |
| 사용자 입력 | radio | `1 \| 2 \| 3` |
| 출력 | 세션 | `Intent.surface_constraints.grade ∈ {1, 2, 3}` (부분 채움) |
| 출력 | 라우팅 | `/app/new/topic` (다음) / `/app` (취소) |

**불변식:** `Intent.school_level` 은 MVP 단계에서 `"middle"` 로 고정 (USER_FLOW §3.2). UI 노출 없음.

### 접근성

- **키보드:** `Tab` 으로 첫 radio 진입 → `↑↓` (또는 `←→`) 화살표키로 selection 이동 (radio group 표준 동작) → `Tab` 으로 action-bar 의 "취소" → "다음 →".
- **스크린리더:**
  - 3개 카드를 `role="radiogroup"` + `aria-labelledby="<page-title-id>"` 로 묶음.
  - 각 카드 `role="radio"` + `aria-checked`.
  - Page title `<h1>`.
- **Disabled CTA:** `button-primary` 가 disabled 일 때 `aria-disabled="true"` + 클릭 가능 (focus 진입 가능) — disabled 사유를 `aria-describedby` 로 연결 ("학년을 1개 선택하세요").

---

## S2 — 단원 선택

**URL:** `/app/new/topic`
**Surface:** Productivity

### 화면 구성요소

| 영역 | 컴포넌트 | 비고 |
|---|---|---|
| Sub nav | `{component.sub-nav}` | "← 학년 선택" · "(2/4)" |
| Page title | `{typography.heading-xl}` | "어느 단원인가요?" |
| Filter row | `{component.filter-chip}` + `{component.filter-chip-active}` × N | 대단원 필터 ("전체" / "수와 연산" / "문자와 식" / "함수" / "기하" / "확률과 통계") |
| Topic grid | `{component.intent-radio-card}` × N | 학년·필터에 해당하는 성취기준 단위 카드 (1열 또는 2열) |
| Topic card 내부 | `{typography.body-strong}` 단원명 + `{component.meta-pill}` 성취기준 코드 + `{typography.body-sm}` `{colors.ink-3}` 성취기준 본문 1줄 | e.g. `[9수04-12]` "일차방정식의 풀이" |
| Empty state | `{typography.body-md}` `{colors.ink-3}` | 필터 결과 0건 시 "해당 학년·영역에 등록된 단원이 없습니다" |
| Action bar | `{component.action-bar-sticky}` | "← 뒤로" / "다음 →" |

### 상태 목록

`filter-chip`:

| 상태 | 표현 |
|---|---|
| Default | bg `{colors.canvas-pure}`, text `{colors.ink}`, 1px `{colors.hairline}` |
| Active | `{component.filter-chip-active}` — bg `{colors.ink}`, text `{colors.on-ink}` — 완전 인버스 (중간 상태 없음) |

페이지 단위:

| 상태 | 표현 |
|---|---|
| Loading | 정적 데이터 (`packages/web` 번들 포함) 이므로 사실상 없음. 첫 페인트 시 카드 grid skeleton 불필요 |
| Empty | filter 가 0건일 때 helper text 노출 |
| Selected | 1개 카드 active, 나머지 default — radio group 동작 |

### 데이터

| 항목 | 방향 | 값 |
|---|---|---|
| 입력 | 세션 | `Intent.surface_constraints.grade` (S1 산출) |
| 입력 | 정적 | 2022 개정 교육과정 단원 트리 (학년별 필터) |
| 사용자 입력 | filter | 대단원 1개 (또는 "전체") |
| 사용자 입력 | radio | 단원 1개 |
| 출력 | 세션 | `Intent.objective_code` + `Intent.objective_description` (`domain.md` §2.2) |
| 출력 | 라우팅 | `/app/new/intent` (다음) / `/app/new/grade` (뒤로) |

**도메인 매핑:** 선택된 카드의 `topic_code` 는 `SourceProblem.topic_code` (`domain.md` §2.1) 와 동일 코드 — S4 의 1/6 RAG 검색 키.

### 접근성

- **키보드:** filter-chip row 는 `role="tablist"` 가 아닌 toolbar — `Tab` 으로 chip 진입 → 화살표키로 chip 간 이동 → `Space` / `Enter` 로 활성. 단원 카드는 S1 과 동일한 radio group 동작.
- **스크린리더:**
  - filter-chip-active 는 `aria-pressed="true"`.
  - 단원 카드 `aria-label` 형식: "9수04-12 일차방정식의 풀이 — 일차식의 양변에 같은 수를 더하거나 빼는 변형…" (코드 + 단원명 + 성취기준 1줄).
  - 카드 안 meta-pill 코드 자체는 `aria-hidden="true"` (aria-label 에 이미 포함).
- **필터 결과 변화:** filter-chip 변경 시 카드 grid 가 동적으로 바뀜 — `aria-live="polite"` 영역에 "12개 단원 표시" 같은 카운트 안내.

---

## S3 — 동형 모드 + 평가 차원

**URL:** `/app/new/intent`
**Surface:** Productivity

### 화면 구성요소

| 영역 | 컴포넌트 | 비고 |
|---|---|---|
| Sub nav | `{component.sub-nav}` | "← 단원 선택" · "(3/4) 의도 확인" |
| Page title | `{typography.heading-xl}` | "어떻게 출제할까요?" |
| Section A header | `{typography.heading-md}` | "어떤 동형으로 생성할까요?" |
| Section A choice | `{component.intent-radio-card}` × 2 | "구조 동형" + `{component.badge-pass}` ✓ / "개념 동형" + `{component.badge-concept}` ✦ |
| Section A card body | `{typography.body-md}` + `{typography.body-sm}` `{colors.ink-3}` | label + 1~2줄 설명 |
| Section B header | `{typography.heading-md}` | "보존해야 하는 능력은?" |
| Section B helper | `{component.inline-notice-warn}` | "이 차원을 보존해야 동형으로 인정됩니다" |
| Section B checkbox list | `{component.intent-checkbox}` × N | 단원의 성취기준에서 자동 후보 추출, 기본 1개 이상 체크됨 |
| Checkbox 내부 | `[키 코드]` `{typography.body-strong}` + label `{typography.body-md}` | e.g. `[A]` "두 조건식에서 a₁과 d를 연립으로 구함" |
| Action bar | `{component.action-bar-sticky}` | "← 뒤로" / `{component.button-primary}` "생성하기 →" |

### 상태 목록

`intent-radio-card` (Section A): S1 과 동일 (default / focused / active).

`intent-checkbox` (Section B):

| 상태 | 표현 |
|---|---|
| Default | bg `{colors.canvas-pure}`, 1px `{colors.hairline}`, checkbox icon outline |
| Active (체크) | `{component.intent-checkbox-active}` — bg `{colors.soft-cloud}`, border 2px `{colors.ink}` (padding `13px 17px` 으로 compensate), checkbox icon filled `{colors.ink}` |
| Focused | focus-ring 2px `{colors.primary}` |

페이지 단위:

| 상태 | `button-primary` 활성 조건 |
|---|---|
| Section A unselected | disabled |
| Section B 0개 체크 | disabled |
| 모두 충족 | enabled |
| Submitting | spinner-dot, 클릭 후 즉시 라우팅 (SSE 연결은 다음 화면에서) |

### 데이터

| 항목 | 방향 | 값 |
|---|---|---|
| 입력 | 세션 | `Intent.objective_code` (S2 산출) |
| 입력 | 정적 | 해당 성취기준의 권장 평가 차원 후보 (사전 정의) |
| 사용자 입력 | Section A | `"structural" \| "conceptual"` (동형 모드, `Intent` 외부 메타) |
| 사용자 입력 | Section B | `EvaluationDimension[]` 의 `must_preserve = true` 항목 1개 이상 |
| 출력 | 세션 | 완성된 `Intent` 객체 (`domain.md` §2.2) + 동형 모드 메타 |
| 출력 | 라우팅 | `/app/new/verify` (다음, SSE 연결 시작) / `/app/new/topic` (뒤로) |

### 접근성

- **키보드:** Section A radio group 진입 → 화살표키 선택 → Section B 첫 checkbox → `Tab` 으로 checkbox 간 이동 (radio 와 달리 checkbox 는 화살표 그룹이 아님), `Space` 로 토글 → action-bar.
- **스크린리더:**
  - Section A: `role="radiogroup"` + `aria-labelledby` Section A header.
  - Section B: 각 checkbox `<input type="checkbox">` 시맨틱 사용, label 연결.
  - `inline-notice-warn` 은 `role="note"`.
  - 키 코드 `[A]` 는 시각 라벨 — 스크린리더는 "두 조건식에서…" 본문을 읽음, 키 코드는 `aria-hidden="true"` 또는 "차원 에이" 로 풀어 읽기.
- **Required 표기:** Section B "1개 이상" 강제는 `aria-required="true"` 를 fieldset 단위로 적용. 0개일 때 fieldset 에 `aria-describedby` 로 "1개 이상 선택하세요" 연결.

---

## S4 — 검증 진행

**URL:** `/app/new/verify`
**Surface:** Productivity

### 화면 구성요소

| 영역 | 컴포넌트 | 비고 |
|---|---|---|
| Sub nav | `{component.sub-nav}` | "← 의도 확인" · "(4/4) 검증 진행" |
| Page title | `{typography.heading-xl}` | "검증하고 있습니다" |
| Subtitle | `{typography.body-lg}` `{colors.ink-3}` | "생성과 검증을 6단계로 진행합니다. 보통 5~30초 걸려요." |
| Step progress list | `{component.step-progress-row}` × 6 | 행 순서: RAG 검색 / 의도 추출 / 문제 생성 / 산술 검증 (SymPy) / 독립 재풀이 / 학습 목표 매핑 |
| Preview (3/6 이후) | `{component.formula-stage}` | 생성된 첫 후보 문항의 LaTeX 미리보기 (KaTeX SSR) |
| Action bar | `{component.action-bar-sticky}` | 좌: `{component.button-secondary}` "취소" 만 / 우: 비어 있음 (primary 비노출) |

`step-progress-row` 내부 구조 (좌→우):
- step 번호 (Mono `{typography.caption-sm}`, width 50px) e.g. "1/6"
- step 이름 (`{typography.body-strong}`)
- 결과 요약 (`{typography.body-md}` `{colors.ink-3}`) — 상태별 자리표시
- 상태 아이콘 (22px circle, 우측 정렬)

### 상태 목록

`step-progress-row` 행 상태 (한 시점에 `-active` 는 정확히 1개):

| 상태 | 좌측 indicator | 아이콘 | 텍스트 색 | 결과 자리 |
|---|---|---|---|---|
| `-pending` | 없음 | "·" `{colors.ink-4}` | `{colors.ink-4}` | 빈칸 |
| `-active` | 3px solid `{colors.ink}` left border | `{component.spinner-dot}` (회전) | `{colors.ink}` | "진행 중…" |
| `-pass` | 없음 | ✓ on `{colors.pass-100}` bg | `{colors.pass-deep}` | 요약 e.g. "12개 참조 발견" |
| `-fail` | 없음 | ✗ on `{colors.fail-100}` bg | `{colors.fail-deep}` | 실패 사유 1줄 |

페이지 단위:

| 상태 | 트리거 | 표현 |
|---|---|---|
| Connecting | 라우팅 직후 ~ SSE 첫 이벤트 전 | 모든 row `-pending`, 1/6 row 만 `-active` 로 옮길 준비 |
| Streaming | SSE 정상 | 위 행 상태 머신대로 진행 |
| Preview-visible | 3/6 `-pass` 직후 | `formula-stage` 페이드인 (`prefers-reduced-motion` 시 즉시) |
| Stream-error | SSE 연결 끊김 | `{component.inline-notice-fail}` "연결이 끊겼습니다 — 다시 시도" + action-bar 우측에 `button-primary` "다시 시작" 등장 |
| All-pass | 6/6 `-pass` | 자동 라우팅 → S5 (약 600ms delay, 사용자가 마지막 ✓ 인지 가능하게) |
| Partial-warn | 6/6 `-warn` (학습 목표 매핑 미확인) | row 에 `{component.badge-warn}` 표기, S5 로 진행 |
| Cancelled | 사용자가 "취소" 클릭 | 즉시 S3 로 라우팅, 클라이언트가 SSE 연결 close |

### 데이터

| 항목 | 방향 | 값 |
|---|---|---|
| 입력 | 세션 | 완성된 `Intent` + 동형 모드 메타 |
| 입력 | SSE (서버) | `agent` 의 `event: step.start` / `event: step.complete` / `event: candidate.preview` / `event: pipeline.done` / `event: error` |
| 클라이언트 상태 | 누적 | 각 step 의 status + summary, candidate preview LaTeX |
| 출력 | 세션 | `Verification` 객체 + `GeneratedProblem[]` (후보) |
| 출력 | 라우팅 | `/app/new/result` (성공·부분통과) / `/app/new/intent` (사용자 취소·복구불가 실패) |

**SSE 컨트랙트:** USER_FLOW.md §3.5 의 6단계 매핑을 따른다. 각 step `id` 는 1..6 고정.

### 접근성

- **키보드:** `Tab` 진입은 "취소" 버튼 1개. step-progress-row 는 진입 대상 아님 (정보 표시 전용).
- **스크린리더:**
  - Step list 컨테이너 `role="list"` + 각 row `role="listitem"`.
  - 가장 중요: 동적 진행 상황은 `aria-live="polite"` 영역으로 분리하여 step pass 시마다 "1/6 RAG 검색 통과, 12개 참조 발견" 음성 안내. `assertive` 는 피함 — 6단계 모두 연속 발화하면 시끄러움.
  - 실패 발생 시에는 별도 `role="alert"` 영역에서 즉시 발화 ("산술 검증 실패 — 4/6 단계에서 후보 1개 폐기").
  - `formula-stage` 의 LaTeX 는 KaTeX 의 MathML fallback 으로 의미 운반. KaTeX `output: "htmlAndMathml"` 설정 (스크린리더가 MathML 만 읽음, sighted 는 HTML span 만 봄).
- **Motion:** `spinner-dot` 의 회전 애니메이션은 `prefers-reduced-motion` 시 정적 점멸 (또는 단순 ⠿ 점 3개 정적 표시) 로 대체.
- **취소 동작:** `Esc` 키로 "취소" 버튼 클릭과 동일 동작 — 사용자가 멈추고 싶을 때 가장 빠른 경로.

---

## S5 — 결과 확인 + 수정

**URL:** `/app/new/result`
**Surface:** Productivity

### 화면 구성요소

| 영역 | 컴포넌트 | 비고 |
|---|---|---|
| Sub nav | `{component.sub-nav}` | "← 검증 진행 / 결과" · 우측 progress 카운터 없음 |
| Page title | `{typography.heading-xl}` | "3개 문항이 준비되었습니다" — 동적 카운트 |
| Filter row | `{component.filter-chip}` × M | "전체" / "구조동형" / "개념동형" / "주의" / "실패" |
| Result grid | `{component.result-card}` × N (3-up → 1024px↓ 2-up → 600px↓ 1-up) | |
| Card head | `{typography.body-strong}` 문항 번호 + `{component.badge-pass}` / `{component.badge-concept}` / `{component.badge-warn}` + 아이콘 클러스터 (`{component.button-icon-circular}` ★ 즐겨찾기 / ↻ 재생성 / ✎ 수정 / × 폐기) | padding `16px 20px`, border-bottom `{colors.hairline-soft}` |
| Card body | `{component.formula-stage}` | LaTeX 문제 본문 (KaTeX), padding `28px 24px`, min-height 120px |
| Card meta | 정답 + `{component.disclosure-row}` "풀이 보기" + secondary 액션 | padding `16px 20px`, border-top `{colors.hairline-soft}` |
| 실패 카드 | `{component.result-card-failed}` | result-card + 4px left border `{colors.fail}` + 카드 head 아래 `{component.inline-notice-fail}` "독립 재풀이에서 답 불일치 — 검토 필요" |
| Action bar | `{component.action-bar-sticky}` | 좌: `{component.button-secondary}` "다시 검증" / 우: `{component.button-ink}` "PDF 만들기 →" |

### 상태 목록

`result-card`:

| 상태 | 표현 |
|---|---|
| Default (pass) | bg `{colors.canvas-pure}`, 1px `{colors.hairline-soft}`, `badge-pass` 또는 `badge-concept` |
| Warn (부분통과) | 동일 카드 + `badge-warn` + `{component.inline-notice-warn}` 한 줄 inline |
| Fail | `{component.result-card-failed}` — left 4px `{colors.fail}` + `inline-notice-fail` |
| Adopted (사용자 채택) | ★ 아이콘 filled `{colors.ink}`. 그 외 시각 변화 없음 (border / bg 변경 없음 — 결과 카드 시각 자체는 *검증 결과* 의 의미만 유지) |
| Editing | `formula-stage` 가 inline textarea 로 전환, KaTeX preview 우측 분할 |
| Re-verifying | 카드 위에 `{component.spinner-dot}` overlay + opacity 0.6, 4/6·5/6 만 재검증 |

페이지 단위:

| 상태 | 표현 |
|---|---|
| All-failed (0개 통과) | action-bar 우측 비활성, "다시 검증" 만 — PDF 출력 차단 |
| 1개 이상 채택 | `button-ink` "PDF 만들기 →" 활성 |
| 0개 채택 | "PDF 만들기" disabled + `aria-describedby` "1개 이상 채택하세요" |

### 데이터

| 항목 | 방향 | 값 |
|---|---|---|
| 입력 | 세션 | S4 의 `Verification` + `GeneratedProblem[]` |
| 입력 | 정적 | 필터 정의 (5종) |
| 사용자 입력 | filter-chip | 필터 1개 |
| 사용자 입력 | 카드 액션 | 채택 / 재생성 / 수정 / 폐기 |
| 사용자 입력 | 수정 모드 | LaTeX 텍스트 |
| 출력 (수정) | 부분 재검증 | `agent` 의 `POST /verify/partial` (4/6·5/6 만) → 카드 결과 갱신 |
| 출력 (액션 바) | 세션 | 채택된 `GeneratedProblem[]` |
| 출력 | 라우팅 | `/app/new/export` (PDF) / `/app/new/verify` (다시 검증) |

### 접근성

- **키보드:**
  - filter-chip toolbar (S2 와 동일 동작).
  - 카드 간 `Tab` 이동 — 카드 head 의 아이콘 클러스터로 진입 → `Tab` 으로 ★ / ↻ / ✎ / × 순회 → `formula-stage` skip (정적) → meta 의 disclosure-row → 다음 카드.
  - 수정 모드 진입 후 `Esc` 로 변경 폐기 + 닫기, `Ctrl/Cmd+Enter` 로 저장 + 재검증.
- **스크린리더:**
  - 각 result-card `<article>` + `aria-labelledby` 문항 번호.
  - badge 는 visually-hidden 텍스트 포함 ("구조동형으로 검증 통과", "개념동형으로 검증 통과", "부분 통과 — 주의 필요", "실패 — 검토 필요"). 색 + 아이콘 외 텍스트로도 의미 운반.
  - `inline-notice-fail` 은 `role="status"` 또는 카드 안 인라인이므로 `aria-live` 불필요 (정적 노출).
  - 채택 토글 (★) 은 `<button aria-pressed="true|false">`.
  - `formula-stage` 의 LaTeX 는 S4 와 동일 (KaTeX MathML).
  - disclosure-row "풀이 보기" 는 `<button aria-expanded>` + 펼친 콘텐츠는 같은 카드 안에 inline.
- **Color-only 금지:** 검증 시그널은 색 (`{colors.pass}` / `{colors.fail}` / `{colors.concept}` / `{colors.warn}`) + 아이콘 (✓ / ✗ / ✦ / ⚠) + 텍스트 (badge label) 세 가지로 동시 노출.

---

## S6 — PDF 출력

**URL:** `/app/new/export`
**Surface:** Productivity

### 화면 구성요소

| 영역 | 컴포넌트 | 비고 |
|---|---|---|
| Sub nav | `{component.sub-nav}` | "← 결과 / PDF 출력" |
| Page title | `{typography.heading-xl}` | "시험지 미리보기" |
| 2-column layout | 좌 60% preview / 우 40% options | tablet 이하 1-up |
| Preview | `{component.pdf-preview-thumbnail}` | A4 1:1.41 비율, bg `{colors.soft-cloud}`, padding `32px 28px`, max-width 420px |
| Preview 내부 | 헤더 (제목·날짜·이름란) + 문항 1~3 mini-render | KaTeX render, 작은 크기 |
| Options | `{component.disclosure-row}` × N | "제목 / 날짜 / 학년·반 / 정답표 포함 / 문항 셔플 / 폰트 크기" |
| Disclosure 펼침 | `{typography.body-md}` input / radio | 각 옵션의 입력 필드 |
| Action bar | `{component.action-bar-sticky}` | 좌: `{component.button-secondary}` "결과로" / 우: `{component.button-primary}` "PDF 다운로드 ↓" |
| 다운로드 완료 | `{component.inline-notice-pass}` | 페이지 상단 inline "PDF 가 다운로드되었습니다" — 화면 잔류 |

### 상태 목록

| 상태 | 표현 |
|---|---|
| Default | preview 와 options 모두 활성, "PDF 다운로드" 활성 |
| Editing option | 해당 disclosure-row 펼쳐짐 (`aria-expanded="true"`), preview 가 즉시 반영 (제목·날짜 변경 시 thumbnail 헤더 실시간 갱신) |
| Generating | "PDF 다운로드" 가 `{component.spinner-dot}` 으로 전환, disabled |
| Generated | `inline-notice-pass` 등장 + 브라우저 다운로드 트리거. 버튼은 다시 default |
| Error | `{component.inline-notice-fail}` "PDF 생성 실패 — 다시 시도" + 버튼 default |

### 데이터

| 항목 | 방향 | 값 |
|---|---|---|
| 입력 | 세션 | S5 의 채택된 `GeneratedProblem[]` |
| 사용자 입력 | options | `{ title, date, grade_label, include_answers, shuffle, font_size }` |
| 출력 (다운로드) | 파일 | `시험지_<grade>_<date>.pdf` (A4) |
| 출력 (브라우저) | navigator | 다운로드 API 호출 (URL 변경 없음) |
| 출력 (라우팅) | "결과로" 클릭 | `/app/new/result` |

**렌더링:** MVP 는 클라이언트 사이드 KaTeX → HTML → 브라우저 print API 또는 jsPDF (USER_FLOW §3.7). 한글 폰트 임베드 포함 서버 사이드 렌더링은 v2.

### 접근성

- **키보드:**
  - `Tab` 으로 disclosure-row 순회 → `Enter` / `Space` 로 펼침/접힘 → 안의 input 으로 `Tab` 진입.
  - `Ctrl/Cmd+S` 또는 `Ctrl/Cmd+P` 같은 시스템 단축키는 가로채지 않음 (브라우저 표준 print 동작 양보).
- **스크린리더:**
  - 2-column layout 은 `<main>` + `<aside>` 시맨틱 — preview 가 main, options 가 aside (또는 그 역).
  - `pdf-preview-thumbnail` 은 `role="img"` + `aria-label` "시험지 미리보기 — 중1 일차방정식 3문항, 정답표 포함" 형식의 요약. 안의 텍스트는 `aria-hidden="true"` (preview 라 미니 텍스트는 의미 운반 아님).
  - disclosure-row `<button aria-expanded>` + 펼친 콘텐츠는 `aria-controls` 로 연결.
  - 다운로드 완료 시 `inline-notice-pass` 는 `role="status"` + `aria-live="polite"` — 화면 잔류 후 "PDF 가 다운로드되었습니다" 1회 발화.
- **다운로드 trigger:** `<a download>` 또는 programmatic `URL.createObjectURL` + click — 둘 다 키보드 사용자에게 brower-native 다운로드 알림이 노출되도록 함.

---

## 부록 — 화면 간 공통 패턴

### sub-nav breadcrumb

S1~S6 모두 좌측 breadcrumb. 형식:

```
← <직전 화면 이름> / <현재 화면 이름>
```

`←` 클릭 = 브라우저 history.back 과 동일 동작 + 세션 상태 보존. action-bar 의 "취소" / "뒤로" 와 *기능은 같지만 의미가 다름* — breadcrumb 은 navigational, action-bar 는 transactional.

스크린리더에서는 sub-nav 전체를 `<nav aria-label="단계 이동">` 으로 감싸고, 우측 progress 카운터 ("(1/4)") 는 같은 nav 안에 `aria-label="4단계 중 1단계"` 로 풀어 읽기.

### action-bar-sticky

S1~S6 모두. 모바일에서 fixed bottom, 데스크탑에서 sticky.

좌측 secondary / 우측 primary 의 비대칭 배치를 깨지 않음 — 사용자가 "다음으로 가는 행동" 의 위치를 화면마다 다시 찾지 않게 (`DESIGN.md` 의 핵심 패턴).

action-bar 의 primary 가 disabled 일 때:
- `aria-disabled="true"` (실제 `disabled` 속성도 가능하나 focus 진입 가능 쪽이 안내에 유리)
- `aria-describedby` 로 사유 라벨 연결 ("학년을 1개 선택하세요", "1개 이상 채택하세요" 등)

### 검증 시그널 삼중 표기

`{colors.pass}` / `{colors.fail}` / `{colors.concept}` / `{colors.warn}` 가 등장하는 모든 자리는 동시에:
- **색** — DESIGN.md 의 시그널 컬러
- **아이콘** — ✓ / ✗ / ✦ / ⚠
- **텍스트** — badge label, visually-hidden 보조 라벨, 또는 inline-notice 본문

세 가지 중 하나라도 빠지면 색맹·스크린리더 사용자 한 쪽이 의미를 잃는다.

### Motion fallback

`prefers-reduced-motion: reduce` 시 다음이 무효 또는 정적으로 대체:

| 자리 | Default | Reduced |
|---|---|---|
| Landing book-cover flip | 168° rotateY 1초 cubic-bezier | 정적 (호버해도 회전 X) |
| Landing floating-token parallax | -40px~-24px translate | 정적 |
| S4 spinner-dot 회전 | 700ms linear infinite | 정적 점 또는 점멸 |
| S4 step-progress-row 상태 전환 | opacity / color transition | 즉시 |
| S5 result-card editing 모드 진입 | slide-in editor | 즉시 swap |
| S6 disclosure-row 펼침 | height transition | 즉시 |

`DESIGN.md` Known Gaps §"랜딩 book-stack 모션 접근성" 와 동일 정책을 모든 productivity 화면에 확장.

---
