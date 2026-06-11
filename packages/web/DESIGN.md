---
version: alpha
name: OpenMath
description: |
  편집적(editorial) 랜딩과 생산성(productivity) 출제 도구가 한 시스템 안에서
  공존하는 듀얼 서피스 디자인. 워밍 아이보리 캔버스 위 Fraunces 세리프 디스플레이가
  랜딩의 신뢰감과 책-같은 권위를 만들고, 같은 토큰 위에서 화이트 캔버스와 Inter sans가
  앱 내부의 검증 결과 카드·6단계 진행·의도 체크박스를 정확하게 떠받친다. 모든 색채 에너지는
  수식(LaTeX)과 검증 시그널(통과 green / 실패 coral / 개념 동형 blue / 주의 amber)에
  집중되고, 크롬은 ink / canvas / soft-cloud / paper 의 단색 절제 위에 단 하나의
  블루(primary action) 만 허용한다. 사진(photography) 의 자리를 LaTeX 수식과
  3D book stack 이 차지하며, 그 어느 페이지도 brand color 두 가지 이상을
  같은 fold 에 두지 않는다.

forked-from:
  source: Nike DESIGN.md (https://getdesign.md/nike/design-md)
  identity-source: OpenMath Landing.html (this repo — packages/web/app/page.tsx)
  changes:
    - dual-surface: Editorial (Landing/marketing) + Productivity (출제 도구 앱 내부) 두 surface 명시
    - typography: Helvetica/Pretendard → Inter + Fraunces serif display + Noto family Korean fallback
    - colors: athletic accent palette 전체 제거; warm ivory canvas + 단일 primary blue + verification semantic 컬러만
    - components: 책 스택(book-stack-tile), 떠다니는 토큰(floating-token), eyebrow pill, brand-mark 추가; result-card / step-progress-row / intent-checkbox 유지
    - voice: athletic editorial → 학술/연구 도구(editorial) + 출제 productivity(앱 내부)

supersedes:
  - path: docs/product/DESIGN.md
    reason: 11 화면 mockup 의 productivity-surface 컴포넌트 spec 을 본 문서로 통합. 기존 spec 은 historical reference 로 유지.

colors:
  primary: "#3b82f6"

  # Surfaces
  canvas: "#fafaf9"
  canvas-2: "#f5f5f4"
  canvas-pure: "#ffffff"
  paper: "#fbf8f1"
  soft-cloud: "#f5f5f5"

  # Text
  ink: "#27272a"
  on-ink: "#ffffff"
  ink-2: "#3f3f46"
  ink-3: "#71717a"
  ink-4: "#a1a1aa"
  on-paper: "#27272a"

  # Rules / hairlines
  rule: "#e7e5e0"
  rule-soft: "#f5f5f4"
  hairline: "#cacacb"
  hairline-soft: "#e5e5e5"

  # Primary action (the only chrome accent)
  primary-soft: "#60a5fa"
  primary-deep: "#2563eb"
  primary-100: "#dbeafe"
  primary-50: "#eff6ff"

  # Verification: pass
  pass: "#22c55e"
  pass-soft: "#4ade80"
  pass-deep: "#16a34a"
  pass-100: "#dcfce7"
  pass-50: "#f0fdf4"

  # Verification: fail
  fail: "#fb7185"
  fail-deep: "#e11d48"
  fail-100: "#ffe4e6"

  # Verification: concept-isomorphic (개념 동형)
  concept: "#93c5fd"
  concept-deep: "#3b82f6"
  concept-100: "#dbeafe"

  # Verification: warn (부분 통과·주의)
  warn: "#fbbf24"
  warn-deep: "#d97706"
  warn-100: "#fef3c7"

typography:
  display-hero:
    fontFamily: "Fraunces, 'Noto Serif KR', serif"
    fontSize: "clamp(48px, 8vw, 104px)"
    fontWeight: 300
    lineHeight: 0.96
    letterSpacing: "-0.035em"
  display-section:
    fontFamily: "Fraunces, 'Noto Serif KR', serif"
    fontSize: 72px
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  heading-xl:
    fontFamily: "Fraunces, 'Noto Serif KR', serif"
    fontSize: 32px
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  heading-lg:
    fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0
  heading-md:
    fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0
  body-lg:
    fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  body-md:
    fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  body-strong:
    fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.55
    letterSpacing: 0
  body-sm:
    fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  button-md:
    fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif"
    fontSize: 13.5px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0
  button-sm:
    fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif"
    fontSize: 12.5px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0
  link-md:
    fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.55
    letterSpacing: 0
    textDecoration: underline
  caption-md:
    fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  caption-sm:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: 11.5px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.04em"
  utility-xs:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: 10.5px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.08em"
  mono-md:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  display-glyph:
    fontFamily: "Fraunces, 'Cambria Math', serif"
    fontSize: 52px
    fontWeight: 300
    fontStyle: italic
    lineHeight: 0.9
    letterSpacing: "-0.02em"

rounded:
  none: 0
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  pill: 9999px
  mark: 9px
  book: "4px 14px 14px 4px"

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 48px
  hero: 96px

components:
  # ---------- Buttons (universal) ----------
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: "13px 22px"
    height: 44px

  button-primary-active:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.on-ink}"

  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: "13px 22px"
    height: 44px

  button-ghost:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: "13px 22px"
    height: 44px

  button-secondary:
    backgroundColor: "{colors.canvas-2}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.pill}"
    padding: "13px 22px"
    height: 44px

  button-icon-circular:
    backgroundColor: "{colors.canvas-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: 40px

  filter-chip:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.ink}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: 36px
    border: "1px solid {colors.hairline}"

  filter-chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: 36px

  # ---------- Editorial surface (Landing) ----------
  eyebrow:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    typography: "{typography.caption-sm}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
    border: "1px solid {colors.rule}"

  brand-mark:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.mark}"
    size: 30px

  meta-pill:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.caption-sm}"
    rounded: "{rounded.xs}"
    padding: "3px 8px"
    border: "1px solid {colors.rule}"

  book-cover:
    textColor: "{colors.on-ink}"
    typography: "{typography.heading-lg}"
    rounded: "{rounded.book}"
    width: 380px
    height: 500px

  floating-token:
    textColor: "{colors.primary-soft}"
    typography: "{typography.display-glyph}"

  hint-pill:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-3}"
    typography: "{typography.utility-xs}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
    border: "1px solid {colors.rule}"

  feature-cell:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.heading-xl}"
    padding: "32px 28px 32px 0"
    border: "1px solid {colors.rule}"

  footline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-3}"
    typography: "{typography.utility-xs}"
    padding: "24px 40px 40px"
    border: "1px solid {colors.rule}"

  # ---------- Productivity surface (앱 내부) ----------
  hero-tile-productivity:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.display-section}"
    padding: "96px 48px"

  job-entry-card:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.ink}"
    typography: "{typography.heading-lg}"
    rounded: "{rounded.none}"
    padding: 32px
    border: "1px solid {colors.hairline-soft}"

  job-entry-card-active:
    backgroundColor: "{colors.soft-cloud}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.ink}"

  result-card:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    border: "1px solid {colors.hairline-soft}"

  result-card-failed:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    border: "1px solid {colors.hairline-soft}"

  formula-stage:
    backgroundColor: "{colors.soft-cloud}"
    textColor: "{colors.ink}"
    typography: "{typography.body-lg}"
    padding: 24px

  step-progress-row:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    padding: "16px 20px"
    border: "1px solid {colors.hairline-soft}"

  step-progress-row-active:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.ink}"

  step-progress-row-pass:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.pass-deep}"

  step-progress-row-fail:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.fail-deep}"

  step-progress-row-pending:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.ink-4}"

  badge-pass:
    backgroundColor: "{colors.pass-100}"
    textColor: "{colors.pass-deep}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"

  badge-fail:
    backgroundColor: "{colors.fail-100}"
    textColor: "{colors.fail-deep}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"

  badge-concept:
    backgroundColor: "{colors.concept-100}"
    textColor: "{colors.concept-deep}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"

  badge-warn:
    backgroundColor: "{colors.warn-100}"
    textColor: "{colors.warn-deep}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"

  badge-fallback:
    backgroundColor: "{colors.warn-100}"
    textColor: "{colors.warn-deep}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
    border: "1px dashed {colors.warn-deep}"

  badge-unverified:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.warn-deep}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
    border: "1px solid {colors.warn-deep}"

  intent-checkbox:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "14px 18px"
    border: "1px solid {colors.hairline}"

  intent-checkbox-active:
    backgroundColor: "{colors.soft-cloud}"
    textColor: "{colors.ink}"
    border: "2px solid {colors.ink}"

  intent-radio-card:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "14px 18px"
    border: "1px solid {colors.hairline}"

  intent-radio-card-active:
    backgroundColor: "{colors.soft-cloud}"
    textColor: "{colors.ink}"
    border: "2px solid {colors.ink}"

  inline-notice-pass:
    backgroundColor: "{colors.pass-100}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"

  inline-notice-fail:
    backgroundColor: "{colors.fail-100}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"

  inline-notice-warn:
    backgroundColor: "{colors.warn-100}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"

  pdf-preview-thumbnail:
    backgroundColor: "{colors.soft-cloud}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "32px 28px"

  utility-bar:
    backgroundColor: "{colors.canvas-2}"
    textColor: "{colors.ink}"
    typography: "{typography.caption-sm}"
    height: 36px

  primary-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    height: 64px
    padding: "24px 40px"

  sub-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-3}"
    typography: "{typography.caption-md}"
    height: 48px

  action-bar-sticky:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.ink}"
    height: 80px
    border: "1px solid {colors.hairline-soft}"

  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-3}"
    typography: "{typography.caption-md}"
    padding: "48px 40px 32px"

  disclosure-row:
    backgroundColor: "{colors.canvas-pure}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    padding: "24px 0"
    border: "1px solid {colors.hairline}"

  spinner-dot:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    size: 14px
---

## Overview

OpenMath의 디자인 시스템은 *한 시스템 안의 두 가지 surface* 라는 단 하나의 원칙 위에 서 있다. **Editorial surface** — 랜딩과 마케팅 — 는 워밍 아이보리 캔버스(`{colors.canvas}`) 위에 Fraunces 세리프 디스플레이(`{typography.display-hero}`)를 96~104px 로 띄워 책 같은 신뢰감과 학술의 권위를 만들고, 페이지 가운데에는 학년·단원별 4권의 3D 책 표지(`{component.book-cover}`)가 마우스 움직임에 반응해 표지를 넘기는 모션을 보여준다. 페이지 어디에도 사진은 없다. 사진의 자리에는 `{typography.display-glyph}` 로 띄워진 떠다니는 수식 토큰(`∑ⁿₖ₌₁ k²`, `√(b² − 4ac)`)과 `{typography.mono-md}` 로 흩뿌려진 코드 흔적(`sympy.simplify(...)`, `verified ✓`)이 자리한다.

**Productivity surface** — 앱 내부의 출제 워크플로우 — 는 같은 디자인 토큰 위에서 surface 만 차이를 둔다. 캔버스를 워밍 아이보리(`{colors.canvas}`) 가 아닌 순수 흰색(`{colors.canvas-pure}`) 으로 바꾸고, 디스플레이 폰트를 세리프(`{typography.display-section}`) 에서 빼고, 사진 자리에 LaTeX 수식 스테이지(`{component.formula-stage}`)와 검증 6단계 진행 행(`{component.step-progress-row}`)을 둔다. 컬러 에너지는 오로지 검증 시그널 — 통과 `{colors.pass}` / 실패 `{colors.fail}` / 개념 동형 `{colors.concept}` / 주의 `{colors.warn}` — 에만 집중되며, primary action 으로는 단 한 가지 컬러, `{colors.primary}` (Royal Blue) 만 등장한다.

두 surface 는 동일한 컴포넌트 어휘 — pill 모양 CTA(`{rounded.pill}`), 직각 카드(`{rounded.none}`), 1px hairline 디바이더, 8px 그리드 — 위에서 재료만 바꾸어 만들어진다. 따라서 사용자는 랜딩에서 들어와 앱 내부로 진입해도 단절감을 느끼지 않고, FE 엔지니어는 동일한 토큰 set 만 알면 된다.

**Key Characteristics:**
- 듀얼 서피스 (`editorial` 워밍 아이보리 + `productivity` 순백 캔버스) — 하나의 토큰 set
- `{typography.display-hero}` (Fraunces 96~104px, 0.96 line-height, lightweight 300) 가 랜딩의 단일 디스플레이 티어 — 다른 어디서도 사용 X
- 단 하나의 primary action 컬러 `{colors.primary}` `#3b82f6` (Royal Blue) — 그 외 chrome 은 ink / canvas / soft-cloud 단색
- 검증 시맨틱 컬러 (pass green / fail coral / concept blue / warn amber) 는 **의미만 전달**, 톤·강조용 사용 금지
- Pill geometry (`{rounded.pill}` 9999px) 가 모든 CTA·eyebrow·hint·badge 의 형태 — 직각 버튼 / `{rounded.sm}` 버튼 도입 금지
- 카드(`{component.result-card}`, `{component.job-entry-card}`) 는 zero radius, zero shadow, 1px hairline 만 — Nike 의 product card 원칙 그대로 차용
- 8px base spacing 으로 모든 vertical rhythm 통일, 섹션 간 `{spacing.section}` (48px)
- 한국어 word-break 정책 (`keep-all`) + Pretendard-급 한국어 fallback (`Noto Sans KR`) 기본 적용

## Colors

> **Source:** `OpenMath Landing.html` (editorial surface) + `docs/product/preview/design.css` (productivity surface). 두 출처의 토큰이 본 문서로 융합되었다.

### Surfaces

- **Canvas** (`{colors.canvas}` — `#fafaf9`): editorial surface 의 기본 배경. 약간의 따스함을 가진 아이보리. 랜딩·마케팅 페이지의 모든 large surface 가 이 위에 놓인다.
- **Canvas-2** (`{colors.canvas-2}` — `#f5f5f4`): canvas 보다 살짝 깊은 음영. utility-bar 배경, secondary CTA 배경, 인터랙티브 영역의 hover 표현용.
- **Paper** (`{colors.paper}` — `#fbf8f1`): 책 종이 톤. eyebrow pill 과 hint pill 의 backdrop-blur 배경. 단 두 컴포넌트에서만 사용.
- **Canvas-pure** (`{colors.canvas-pure}` — `#ffffff`): productivity surface 의 기본 배경. result-card / step-progress / intent-checkbox 등 출제 도구 안의 모든 컨테이너가 흰 캔버스 위에 놓인다.
- **Soft Cloud** (`{colors.soft-cloud}` — `#f5f5f5`): productivity 안의 formula-stage, PDF preview thumbnail, intent-checkbox-active 배경. 수식의 "스튜디오" 컬러.

### Text

- **Ink** (`{colors.ink}` — `#27272a`): 모든 본문·헤딩의 기본 컬러. Nike 의 #111111 보다 살짝 따뜻한 zinc-800. `{component.button-ink}` 와 `{component.hero-tile-productivity}` 배경으로도 등장.
- **On-ink** (`{colors.on-ink}` — `#ffffff`): ink 배경 위의 텍스트 컬러. 인버스 본문.
- **Ink-2** (`{colors.ink-2}` — `#3f3f46`): 살짝 부드러운 본문. eyebrow pill, primary-nav link.
- **Ink-3** (`{colors.ink-3}` — `#71717a`): mute. caption, meta-row, sub-nav, footer link.
- **Ink-4** (`{colors.ink-4}` — `#a1a1aa`): 가장 옅은 stone. step-progress-row pending, disabled 텍스트.

### Rules / Hairlines

- **Rule** (`{colors.rule}` — `#e7e5e0`): editorial surface 의 1px 디바이더. 워밍 톤. feature-strip column 사이, footline border.
- **Rule-soft** (`{colors.rule-soft}` — `#f5f5f4`): 더 옅은 디바이더. 거의 보이지 않는 분리선.
- **Hairline** (`{colors.hairline}` — `#cacacb`): productivity surface 의 일반 디바이더. result-card / intent-checkbox 의 border.
- **Hairline-soft** (`{colors.hairline-soft}` — `#e5e5e5`): productivity 의 더 옅은 디바이더. card 내부 row 구분.

### Primary action (the only chrome accent)

- **Primary** (`{colors.primary}` — `#3b82f6`): OpenMath 시스템 전체에서 단 하나의 chrome accent. nav CTA, primary button, 책 표지 그라데이션, 떠다니는 토큰 색. 다른 컬러로 대체 금지.
- **Primary-soft** (`{colors.primary-soft}` — `#60a5fa`): floating-token, gradient via stop.
- **Primary-deep** (`{colors.primary-deep}` — `#2563eb`): primary button pressed state.
- **Primary-100** (`{colors.primary-100}` — `#dbeafe`): badge-concept 배경, info notice 배경.
- **Primary-50** (`{colors.primary-50}` — `#eff6ff`): radial gradient wash (랜딩 페이지 우상단), 거의 보이지 않는 ambient.

### Verification semantics (the only non-chrome colors)

검증 게이트의 결과를 사용자에게 전달하는 컬러. 이 컬러는 의미만 갖는다 — 톤·강조·디바이더로의 차용 금지.

- **Pass** (`{colors.pass}` — `#22c55e`): SymPy 검증 통과, "✓" 시그널. 채도 높은 grass green.
- **Pass-deep** (`{colors.pass-deep}` — `#16a34a`): badge-pass 텍스트, 어두운 배경 위 통과 시그널.
- **Pass-soft** (`{colors.pass-soft}` — `#4ade80`): 책 표지의 verified dot pulse 애니메이션 컬러.
- **Pass-100** (`{colors.pass-100}` — `#dcfce7`): badge-pass / inline-notice-pass 배경.
- **Pass-50** (`{colors.pass-50}` — `#f0fdf4`): radial gradient wash (랜딩 페이지 좌하단).

- **Fail** (`{colors.fail}` — `#fb7185`): 검증 실패, "✗" 시그널. Nike 의 deep red(#d30005) 대신 softer coral — 학생/강사에게 더 친화적.
- **Fail-deep** (`{colors.fail-deep}` — `#e11d48`): badge-fail 텍스트, step-progress-row-fail 텍스트.
- **Fail-100** (`{colors.fail-100}` — `#ffe4e6`): badge-fail / inline-notice-fail / result-card-failed left-border 배경.

- **Concept** (`{colors.concept}` — `#93c5fd`): 개념 동형(conceptual isomorphism) 시그널. soft sky-blue. 구조 동형(structural)과 시각적으로 구분되어야 함.
- **Concept-deep** (`{colors.concept-deep}` — `#3b82f6`): badge-concept 텍스트 — primary blue 와 우연히 동일하지만 의미는 "개념 동형 배지" 한정.
- **Concept-100** (`{colors.concept-100}` — `#dbeafe`): badge-concept 배경.

- **Warn** (`{colors.warn}` — `#fbbf24`): 부분 통과·주의 시그널. amber.
- **Warn-deep** (`{colors.warn-deep}` — `#d97706`): badge-warn 텍스트.
- **Warn-100** (`{colors.warn-100}` — `#fef3c7`): badge-warn / inline-notice-warn 배경.

## Typography

### Font Family

- **Fraunces** (display only) — Google Fonts 의 가변 세리프. 9~144 opsz 축 + 300~600 wght. OpenMath 의 editorial 디스플레이 티어 (96~32px) 를 전담. Latin 글리프 우수, 한국어는 `Noto Serif KR` 로 fallback.
- **Inter** (UI sans, 모든 본문) — Google Fonts 의 variable sans. 400/500/600. 라틴 UI 의 workhorse. 한국어는 `Noto Sans KR` 로 fallback.
- **Noto Serif KR** — 한국어 디스플레이 fallback. Fraunces 와 굵기·세리프 비율 비슷.
- **Noto Sans KR** — 한국어 본문 fallback. Inter 와 트래킹·라인높이 호환.
- **JetBrains Mono** — utility caption (eyebrow, meta, hint, fine-print) 전담. monospaced. 한국어 fallback 없음 (해당 자리에 한국어 출현 시 system-ui 로 대체).

전체 폰트 스택은 Google Fonts 단일 CDN 으로 로드되며, FOUT 방지를 위해 `display=swap` 사용.

### Hierarchy

| Token | Family | Size | Weight | LineHeight | LetterSpacing | Use |
|---|---|---|---|---|---|---|
| `{typography.display-hero}` | Fraunces | clamp(48,8vw,104)px | 300 | 0.96 | -0.035em | 랜딩 메인 헤드라인. 1 페이지 1회. |
| `{typography.display-section}` | Fraunces | 72px | 400 | 0.95 | -0.02em | 앱 내부 hero-tile (S0~). productivity surface. |
| `{typography.heading-xl}` | Fraunces | 32px | 400 | 1.15 | -0.02em | 섹션 헤드라인 (feature-cell h3, page-title). |
| `{typography.heading-lg}` | Inter | 24px | 500 | 1.3 | 0 | 카드 타이틀 (job-entry-card, book-cover-title). |
| `{typography.heading-md}` | Inter | 18px | 500 | 1.5 | 0 | FAQ row, filter group header, sub-title. |
| `{typography.body-lg}` | Inter | 18px | 400 | 1.55 | 0 | hero subtitle, large body. |
| `{typography.body-md}` | Inter | 16px | 400 | 1.55 | 0 | 본문 기본. |
| `{typography.body-strong}` | Inter | 16px | 500 | 1.55 | 0 | 라벨, primary-nav link, step-progress-row name. |
| `{typography.body-sm}` | Inter | 14px | 400 | 1.5 | 0 | 카드 desc, secondary body. |
| `{typography.button-md}` | Inter | 13.5px | 500 | 1 | 0 | 모든 pill CTA. |
| `{typography.button-sm}` | Inter | 12.5px | 500 | 1 | 0 | filter-chip, badge label. |
| `{typography.link-md}` | Inter | 16px | 500 | 1.55 | 0 | inline underlined link. |
| `{typography.caption-md}` | Inter | 13px | 500 | 1.4 | 0 | category subtitle, footer link, badge text. |
| `{typography.caption-sm}` | JetBrains Mono | 11.5px | 400 | 1.5 | 0.04em | eyebrow text, meta-row pill, hint label. |
| `{typography.utility-xs}` | JetBrains Mono | 10.5px | 400 | 1.5 | 0.08em | footline copyright, cover-meta. |
| `{typography.mono-md}` | JetBrains Mono | 14px | 400 | 1.55 | 0 | code/identifier 본문 (`sympy.simplify(...)`, achievement codes). |
| `{typography.display-glyph}` | Fraunces italic | 52px | 300 | 0.9 | -0.02em | 책 표지 글리프 (`∀x`, `y=mx+b`), 떠다니는 수식 토큰. |

### Principles

OpenMath 의 타이포그래피는 *세리프 디스플레이 / sans 본문* 의 명확한 두 티어로 작동한다. Editorial 의 권위는 Fraunces 의 96~32px 디스플레이 티어가, Productivity 의 정밀함은 Inter 의 16~14px 본문 티어가 만든다. 중간 티어 (24~18px) 는 Inter sans 로 통일되어, 디스플레이→본문 점프가 시각적으로 명확하다. 한국어 본문은 항상 `Noto Sans KR` fallback 으로 떨어지며, `word-break: keep-all + overflow-wrap: break-word` 가 기본 적용된다.

### Note on Font Substitutes

Fraunces / Inter / JetBrains Mono / Noto family 는 모두 Google Fonts 무료 + open source. 시스템 폰트로 대체할 일이 발생하면:
- Fraunces → Playfair Display / Cormorant Garamond (둘 다 무료, 비슷한 contrast)
- Inter → system-ui (San Francisco / Segoe UI)
- JetBrains Mono → Menlo / Consolas / ui-monospace

## Layout

### Spacing System

- **Base unit:** 8px
- **Tokens:** `{spacing.xxs}` (2) · `{spacing.xs}` (4) · `{spacing.sm}` (8) · `{spacing.md}` (12) · `{spacing.lg}` (16) · `{spacing.xl}` (24) · `{spacing.xxl}` (32) · `{spacing.section}` (48) · `{spacing.hero}` (96)
- **Universal rhythm:** 모든 페이지의 섹션 vertical gap 은 `{spacing.section}` (48px). 카드 내부 row 간격은 `{spacing.lg}` (16px). 카드 padding 은 32px (job-entry-card) 또는 0 (result-card — 자식이 padding 책임).

### Grid & Container

- **Max width:** `1440px` (랜딩) / `1280px` (productivity). 그 이상 viewport 에서는 outer gutter 가 늘어남.
- **Outer padding:** desktop `40px` / tablet `24px` / mobile `16px`. CSS 변수 `--gutter` 로 노출.
- **Column patterns:**
  - 랜딩 feature-strip: 3-col → 1-col (≤980px)
  - productivity result-grid: 3-up → 2-up (≤1024px) → 1-up (≤600px)
  - productivity entry-grid: 2-up → 1-up (≤768px)
  - footer cols: 4-up → 2-up (≤768px)

### Whitespace Philosophy

여백은 *호흡* 이 아니라 *분리* 의 도구. 섹션은 `{spacing.section}` 리듬으로 수직 적층되고, 섹션 간 장식 라인이나 아이콘 디바이더는 없다. 카드 내부에 padding 을 두르지 않는다 — 카드는 자식이 자기 자리를 책임진다. 한국어 본문 줄 사이는 `line-height 1.55` 로 한국어 글자 높이를 보존한다.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | shadow X, border X | 기본. result-card, job-entry-card, section, button-secondary, badge. 시스템의 지배 처리. |
| 1 — Hairline | 1px solid `{colors.rule}` 또는 `{colors.hairline}` | feature-cell column 디바이더, footer top, disclosure-row 구분. |
| 2 — Hairline-soft | 1px solid `{colors.hairline-soft}` 또는 `{colors.rule-soft}` | result-card 내부 row 구분, action-bar-sticky top. |
| 3 — Left-indicator | 3px solid `{colors.X}` left border | inline-notice 종류 표시, step-progress-row-active 활성 행 표시. 카드 좌측 4px 컬러 막대. |
| 4 — Editorial Shadow | `0 18px 36px rgba(0,0,0,0.20)` + inset | **랜딩의 책 표지 전용**. productivity 에는 절대 등장 X. |
| 5 — Brand-mark Glow | `0 4px 14px rgba(59,130,246,0.3)` + inset | **랜딩의 brand-mark 단 1곳**. 그 외 사용 금지. |

Productivity surface 에서는 elevation 0~3 만 등장한다. 랜딩의 elevation 4~5 (책 그림자 / brand glow) 는 페이지 어디에도 재사용되지 않는다 — 그 자리는 책과 로고만의 자리.

### Decorative Depth

랜딩의 깊이는 CSS 가 아니라 *공간 연출* 로부터 온다:
- 책 스택 (`{component.book-cover}`) 의 perspective 1800px + rotateX 28° 가 페이지에 물리적 입체감을 만든다.
- 떠다니는 수식 토큰 (`{component.floating-token}`) 이 마우스 움직임에 parallax 로 반응 (-40px ~ -24px translate).
- 두 개의 radial gradient (`{colors.primary-50}` 우상단, `{colors.pass-50}` 좌하단) 가 캔버스 모서리를 부드럽게 칠해, 정중앙으로 시선을 모은다.
- 64×64px grid pattern 이 캔버스 위에 4% opacity 로 깔리고, radial mask 로 페이지 가장자리에서 fade out 한다 — "방안지 위에서 출제 작업하는 느낌".

Productivity 의 깊이는 *없다*. 모든 카드는 페이지에 납작히 놓인다. 깊이 cue 는 1px hairline 과 3px left-indicator 뿐.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0 | 모든 카드, hero-tile, footer, primary-nav, result-card, job-entry-card, formula-stage, PDF preview, navigation. 시스템의 지배 형태. |
| `{rounded.xs}` | 4px | book-cover spine 단면, meta-row pill, 매우 작은 inset 그래픽. |
| `{rounded.sm}` | 8px | intent-checkbox, intent-radio-card, inline-notice. |
| `{rounded.md}` | 16px | input, textarea, dropdown. |
| `{rounded.lg}` | 24px | (예약) 모달 / 다이얼로그 도입 시. 현재 미사용. |
| `{rounded.pill}` | 9999px | 모든 CTA (button-primary, button-ink, button-ghost, button-secondary), eyebrow, hint, badge, filter-chip, brand mark dot. |
| `{rounded.mark}` | 9px | brand-mark 로고 컨테이너 한정. 다른 컴포넌트에서 사용 금지. |
| `{rounded.book}` | 4px 14px 14px 4px | book-cover front (좌측 spine 4px, 우측 paper edge 14px). 책 표지 단일 컴포넌트 전용 비대칭 반경. |

### Photography Geometry

OpenMath 는 *사진을 사용하지 않는다*. 사진의 자리에는 다음이 위치한다:

- **랜딩 hero:** 좌측 텍스트 블럭(`{typography.display-hero}`) + 우측 책 스택(`{component.book-cover}` × 4) + 떠다니는 수식 토큰. 사진 대신 *책 + 수식* 으로 brand identity 형성.
- **productivity formula-stage:** `{colors.soft-cloud}` aspect-auto 컨테이너. LaTeX 수식이 page 의 "image" 역할. 수식 자체가 페이지의 시각 중심.
- **PDF preview thumbnail:** A4 비율 (1:1.41) `{colors.soft-cloud}` 컨테이너. 시험지 첫 페이지의 mini-render 가 사진 자리.
- **검증 6단계 progress:** 정렬된 행 스택. 사진 없이 텍스트 + 아이콘 + 상태 색만으로 진행 상태 전달.

## Components

> **No hover states documented** per system policy (Nike 정책 동일). 각 컴포넌트는 Default 와 Active/Pressed 만 명세. 추가 variant 는 별도 `components:` 엔트리로 등록.

### Buttons

**`button-primary`** — 시스템의 유일한 primary action 컬러 사용 컴포넌트
- Background `{colors.primary}`, text `{colors.on-ink}`, type `{typography.button-md}`, padding `13px 22px`, height 44px, rounded `{rounded.pill}`.
- 모든 primary action 에 사용: "무료로 시작하기", "생성하기", "다음", "확인", "PDF 다운로드".
- Pressed (`button-primary-active`): bg → `{colors.primary-deep}`, transform → `translateY(-1px)`.

**`button-ink`** — productivity surface 의 강조 CTA
- Background `{colors.ink}`, text `{colors.on-ink}`, 그 외 button-primary 와 동일.
- 사용처: app 내부의 강조 행동 (예: PDF 확정·제출). primary blue 와 함께 쓰지 않음 — 한 viewport 에 단 하나의 emphasized action.

**`button-ghost`** — backdrop-blur 위의 secondary
- Background `rgba(255,255,255,0.7)`, text `{colors.ink}`, 1px hairline `{colors.rule}`, backdrop-filter blur 6px.
- 랜딩의 "샘플 문제 보기" 같은 alt CTA. editorial surface 한정.

**`button-secondary`** — 평면 위의 soft alternative
- Background `{colors.canvas-2}`, text `{colors.ink}`, rest 동일.
- productivity surface 한정. primary 와 짝 (e.g., "취소" 옆 "생성하기").

**`button-icon-circular`** — 아이콘 전용
- Background `{colors.canvas-2}`, icon `{colors.ink}`, rounded `{rounded.pill}`, size 40px.
- 책 표지 캐러셀, 뒤로가기, 즐겨찾기 등. hit area는 padding 으로 48px 까지 확장.

**`filter-chip`** + **`filter-chip-active`**
- Default: bg `{colors.canvas-pure}`, text `{colors.ink}`, 1px `{colors.hairline}`, rounded `{rounded.pill}`, padding `8px 16px`, height 36px.
- Active: bg `{colors.ink}`, text `{colors.on-ink}` — 칩이 완전히 인버스로 뒤집힘. 중간 상태 없음.

### Editorial surface (Landing)

**`eyebrow`** — 페이지 진입을 알리는 monogram pill
- Background `{colors.paper}`, text `{colors.ink-2}`, type `{typography.caption-sm}` (Mono 11.5px), rounded `{rounded.pill}`, padding `6px 12px`, 1px `{colors.rule}`, backdrop-filter blur 6px.
- 사용처: 랜딩 hero 최상단 ("검증된 문제 한 세트"), eyebrow + dot 패턴.

**`brand-mark`** — OpenMath 로고 컨테이너 단 1곳
- Background `{colors.primary}` linear-gradient `135deg`, icon `{colors.on-ink}`, rounded `{rounded.mark}` (9px), size 30px, glow `0 4px 14px rgba(59,130,246,0.3)`.
- 본 컴포넌트의 그라데이션 + glow + 9px 반경은 *오직 brand mark 자리에서만* 등장. 다른 어디서도 재현 금지.

**`meta-pill`** — 메타데이터 tiny tag
- Background transparent, text `{colors.ink-2}`, type `{typography.caption-sm}`, rounded `{rounded.xs}` (4px), 1px `{colors.rule}`, padding `3px 8px`.
- 사용처: 랜딩 meta-row ("· 회원가입", "· 중1–중3 전 단원").

**`book-cover`** — 시스템의 시그니처
- Width 380px, height 500px, rounded `{rounded.book}` (`4px 14px 14px 4px`), backface-hidden, transform-origin left center, transform-style preserve-3d.
- Front face: 학년·단원별 4가지 그라데이션 (blue / green / orange / zinc — 책 시리즈처럼).
- Spine shadow: `linear-gradient(90deg, rgba(0,0,0,0.32), rgba(0,0,0,0) 80%)` 가 좌측 24px 위에 깔림.
- Paper edge: 우측 5px 에 `repeating-linear-gradient` 로 종이 단면 디테일.
- Inner: cover-top (Mono + serif logo) → cover-title (Fraunces 38px) → cover-bottom (display-glyph + verified meta).
- 마우스 위치에 따라 표지가 좌측 edge 를 축으로 168° 회전하며 진열에서 펼쳐짐 (1초 cubic-bezier ease).

**`floating-token`** — 떠다니는 수식·식별자
- Text `{colors.primary-soft}` (rgba 0.45 alpha), type `{typography.display-glyph}` (Fraunces italic 22px) 또는 `{typography.caption-sm}` (Mono 11px).
- 책 스테이지 주변에 z-index 1 로 배치. data-depth 0.3~0.8 별로 마우스 parallax 차등 반응.

**`hint-pill`** — 인터랙션 안내
- Background `{colors.paper}` rgba 0.85, text `{colors.ink-3}`, type `{typography.utility-xs}` (Mono 10.5px, letter 0.04em), rounded `{rounded.pill}`, padding `7px 14px`, 1px `{colors.rule}`, backdrop-filter blur 8px.
- 사용처: "마우스를 올리면 표지가 넘어갑니다" → mouse-in 시 opacity 0 으로 fade.

**`feature-cell`** — 랜딩 feature-strip 한 칸
- Background `{colors.canvas}`, text `{colors.ink}`, padding `32px 28px 32px 0`, border-right 1px `{colors.rule}`.
- 내부: num caption (Mono 10.5px ink-3) → heading-xl (Fraunces 24px) → body-sm (ink-2).

**`footline`** — 랜딩 페이지 하단 fine-print
- Background `{colors.canvas}`, text `{colors.ink-3}`, type `{typography.utility-xs}`, padding `24px 40px 40px`, border-top 1px `{colors.rule}`.
- 좌우 분리: 좌 (copyright · 위치) / 우 (build version).

### Productivity surface (앱 내부)

**`hero-tile-productivity`** — 앱 내부의 흑색 hero
- Background `{colors.ink}`, text `{colors.on-ink}`, padding `96px 48px`, 미세한 24×24 grid pattern overlay (white 4%).
- 헤드라인 `{typography.display-section}` (Fraunces 72px) on-ink.
- 사용처: S0 메인 진입, 발표/소개 페이지의 hero.

**`job-entry-card`** — 작업 진입 카드 (S0 의 "새 문제" / "이 문제처럼")
- Background `{colors.canvas-pure}`, padding 32px, rounded `{rounded.none}`, 1px `{colors.hairline-soft}`.
- 내부: heading-lg 제목 + body-md 설명 + bullet list (body-sm mute) + button-primary CTA.
- Active (hover/focus): bg → `{colors.soft-cloud}`, border → `{colors.ink}`.

**`result-card`** — 생성된 문제 결과 카드 (S5)
- Background `{colors.canvas-pure}`, rounded `{rounded.none}`, 1px `{colors.hairline-soft}`, padding 0.
- 내부 구조 (각 영역이 자체 padding):
  1. card-head — 문항 번호 + 동형 종류 badge + action 아이콘 cluster (padding `16px 20px`, border-bottom `{colors.hairline-soft}`)
  2. formula-stage — LaTeX 수식 (padding `28px 24px`, min-height 120px)
  3. meta — 정답 + 풀이 토글 + secondary 액션 (padding `16px 20px`, border-top `{colors.hairline-soft}`)

**`result-card-failed`** — 검증 실패 변형
- result-card 위에 left 4px border `{colors.fail}` 추가.
- 카드 안에 inline-notice-fail 한 줄을 head 아래 inline 으로 삽입.

**`formula-stage`** — LaTeX 수식 단색 stage
- Background `{colors.soft-cloud}`, padding 24px, rounded `{rounded.none}`, text `{colors.ink}` `{typography.body-lg}`.
- KaTeX 가 SSR 렌더링 → block 수식은 stage 안에서 가운데 정렬, inline 수식은 본문 baseline 유지.

**`step-progress-row`** — 검증 6단계의 한 행 (S4)
```
[1/6] RAG 검색            ✓ 12개 참조 발견          ← row-pass
[2/6] 의도 추출            ✓ 학습 목표·핵심 제약    ← row-pass
[3/6] 문제 생성            ⠋ 진행 중...            ← row-active (border-left ink)
[4/6] 산술 검증 (SymPy)    ·                       ← row-pending
[5/6] 독립 재풀이          ·                       ← row-pending
[6/6] 학습 목표 매핑       ·                       ← row-pending
```
- Container: bg `{colors.canvas-pure}`, padding `16px 20px`, border-bottom `{colors.hairline-soft}`.
- 좌: step 번호 (Mono caption-sm, width 50px) + step 이름 (body-strong).
- 우: 상태 아이콘 (22px circle) + 결과 요약 (body-md ink-3).
- States: `-pass` (icon bg `{colors.pass-100}`, text `{colors.pass-deep}`) / `-fail` (icon bg `{colors.fail-100}`, text `{colors.fail-deep}`) / `-pending` (icon text `{colors.ink-4}`) / `-active` (border-left 3px `{colors.ink}` + spinner-dot).

**`spinner-dot`** — 진행 인디케이터
- 14px 회색 점에서 ink 점이 회전 (CSS animation 700ms linear infinite).
- step-progress-row-active 의 우측, button 의 loading state 등.

**`badge-pass`** / **`badge-fail`** / **`badge-concept`** / **`badge-warn`**
- Background `{colors.X-100}`, text `{colors.X-deep}`, type `{typography.caption-md}`, rounded `{rounded.pill}`, padding `4px 10px`.
- 모든 result-card head 에 동형 종류 / 검증 상태 badge 표기. 사용자가 한눈에 식별.

**`badge-fallback`** — 결정론 템플릿 출처(provenance) 시그널
- Background `{colors.warn-100}`, text `{colors.warn-deep}`, type `{typography.caption-md}`, rounded `{rounded.pill}`, padding `4px 10px`, **1px dashed `{colors.warn-deep}` border**.
- LLM 이 아닌 결정론 템플릿(`deterministic-topic-generator`)이 후보를 만들었을 때만 result-card head 의 pass/warn/concept/fail badge 옆에 *추가로* 노출. dashed border 가 `{component.badge-warn}` (solid, 동일 amber 팔레트) 과 시각적으로 구분되어, "검증 결과의 부분 통과" 와 "LLM 미관여 폴백" 을 분리.
- 문구는 `⚙ 템플릿 폴백`. 이 badge 가 보이면 사용자(강사)는 해당 문항이 LLM-검증 경로가 아닌 결정론 fallback 으로 만들어졌음을 인지.

**`badge-unverified`** — 기호 검증 불가 (3-state gate model) 시그널
- Background `{colors.canvas-pure}`, text `{colors.warn-deep}`, type `{typography.caption-md}`, rounded `{rounded.pill}`, padding `4px 10px`, **1px solid `{colors.warn-deep}` border** (hollow / outlined 변형).
- agent 의 3-state gate model 에서 어떤 gate(특히 `sympy_verify`)가 `status: "unverified"` 로 emit 됐을 때만 result-card head 의 pass/warn/concept/fail/fallback badge *옆에 추가로* 노출. SymPy 가 해당 문항의 정답을 기호적으로 검증할 수 없었고 독립 재풀이로만 확인됐다는 caveat — verified 처럼 보이지 않도록 사용자(강사)에게 명시.
- Warn 팔레트(amber)를 유지하되 `{component.badge-warn}`(solid filled, "부분 통과")·`{component.badge-fallback}`(solid filled + dashed border, "LLM 미관여")와 시각적으로 구분되도록 hollow(`canvas-pure` bg + solid border)로 변별. 빈 안쪽 = "공식 기호 검증이 채워지지 못함" 의미.
- 문구는 `⊘ 기호 검증 불가`, `title="재풀이로만 확인됨 — SymPy 기호 검증을 수행할 수 없었습니다"`. 1개 문항에 여러 unverified gate 가 있어도 badge 는 1회 노출(orthogonal flag).

**`intent-checkbox`** + **`intent-checkbox-active`** — 평가 차원 선택 (S3-B)
- Default: bg `{colors.canvas-pure}`, padding `14px 18px`, rounded `{rounded.sm}`, 1px `{colors.hairline}`, body-md ink.
- Active: bg → `{colors.soft-cloud}`, border → 2px `{colors.ink}` (padding `13px 17px` 으로 compensate).
- 내부: 좌측 checkbox icon (20×20, rounded 4px) + 라벨 + 키 코드 (body-strong).

**`intent-radio-card`** + **`intent-radio-card-active`** — 동형 모드 선택 (S3-A)
- intent-checkbox 와 spec 동일, dot 형 indicator 만 차이.
- 내부: dot indicator (20×20, rounded.pill, 2px border) + body (label + desc).

**`inline-notice-pass`** / **`inline-notice-fail`** / **`inline-notice-warn`**
- Background `{colors.X-100}`, text `{colors.ink}`, type `{typography.body-md}`, rounded `{rounded.sm}`, padding `12px 16px`, left 3px solid `{colors.X-deep}`.
- 카드 안 / 페이지 상단 인라인 알림. 사람 언어로 한·두 줄.

**`pdf-preview-thumbnail`** — S6 시험지 미리보기
- Background `{colors.soft-cloud}`, aspect 1:1.41 (A4), padding `32px 28px`, rounded `{rounded.none}`, max-width 420px.
- 내부에 시험지 첫 페이지 mini-render — 헤더 + 문항 1~3.

### Navigation

**`utility-bar`** — 최상단 utility (D-3: 강사 1차 MVP)
- bg `{colors.canvas-2}`, text `{colors.ink}`, type `{typography.caption-sm}`, height 36px.
- 우측: "도움말 · 피드백". 1차 MVP 는 두 링크만.

**`primary-nav`** — 메인 nav
- bg `{colors.canvas}`, text `{colors.ink}`, type `{typography.body-strong}`, height 64px, padding `24px 40px`, max-width 1440px.
- 좌: brand-mark + wordmark (Fraunces 20px italic 500).
- 중: nav links (Inter 13.5px, ink-2). 1차 MVP 4 개 ("교육과정", "검증", "문서", "연구") 까지만.
- 우: button-primary "문제 생성하기 →".

**`sub-nav`** — 페이지 sub-navigation
- bg `{colors.canvas}`, text `{colors.ink-3}`, type `{typography.caption-md}`, height 48px.
- 좌: breadcrumb ("← 워크스페이스 / 새 문제 만들기"). 우: 진행 ("(2/4) 의도 확인").

**`action-bar-sticky`** — 페이지 하단 sticky 액션
- bg `{colors.canvas-pure}`, height 80px, border-top 1px `{colors.hairline-soft}`.
- 좌: secondary (취소/뒤로). 우: primary (생성/다음/저장).
- 모바일에서는 화면 하단 fixed.

**`footer`** — 페이지 하단 footer
- bg `{colors.canvas}`, text `{colors.ink-3}`, type `{typography.caption-md}`, padding `48px 40px 32px`, border-top 1px `{colors.hairline}`.
- 4-col: 소개·도움말·캡스톤·피드백. 컬럼 헤더 body-strong ink, 링크 caption-md ink-3.
- 아래 fine-print row `{typography.utility-xs}`.

### Disclosure

**`disclosure-row`** — 의도 확인 / 풀이 토글 / FAQ
- bg `{colors.canvas-pure}`, text `{colors.ink}`, type `{typography.body-strong}`, padding `24px 0`, border-bottom 1px `{colors.hairline}`.
- 좌측 라벨, 우측 chevron-down/up. 확장 시 내부 콘텐츠 `{spacing.lg}` (16px) 위·아래 padding.

### Math Rendering

**`latex-renderer`** — 수식 렌더링
- Library: **KaTeX** (SSR 지원, MathJax 보다 가볍고 시험지 출력에 충분).
- Inline `$...$` — body-md baseline 유지.
- Block `$$...$$` — `{component.formula-stage}` 안에서 가운데 정렬.
- Color: 기본 `{colors.ink}`, 실패 카드의 잘못된 단계 강조는 `{colors.fail-deep}`.

## Do's and Don'ts

### Do

- `{typography.display-hero}` (Fraunces 96~104px) 는 **랜딩 메인 페이지에서만** 사용. 다른 어디서도 등장 X. 앱 내부의 임팩트는 `{typography.display-section}` (72px on `{colors.ink}` hero-tile) 으로 표현.
- `{component.button-primary}` (`{colors.primary}` blue pill) 또는 `{component.button-ink}` (black pill) 중 *단 하나* 를 한 viewport 의 primary action 으로. 둘이 같은 fold 에 동시 등장 금지.
- 수식은 항상 `{component.formula-stage}` `{colors.soft-cloud}` 위. 수식이 페이지의 시각 중심.
- 모든 CTA 를 `{rounded.pill}` 로 통일. 직각 버튼·`{rounded.sm}` 버튼 / `{rounded.md}` 버튼 도입 금지.
- 검증 시그널 색 (`{colors.pass}`, `{colors.fail}`, `{colors.concept}`, `{colors.warn}`) 은 **검증 의미만 전달**. 다른 의미로 차용 금지.
- 섹션 간 `{spacing.section}` (48px) 리듬 일관 적용. 섹션 사이 장식 라인·아이콘 디바이더 금지.
- 결과 카드 헤더에 동형 종류 badge 표기 (`{component.badge-pass}` `✓ 구조동형` / `{component.badge-concept}` `✦ 개념동형` / `{component.badge-warn}` `⚠ 부분`).
- 랜딩의 `{component.book-cover}` 는 4 권 시리즈로 진열. 한 권만 단독으로 배치 금지.
- 한국어 본문에 `word-break: keep-all; overflow-wrap: break-word;` 기본 적용.

### Don't

- 두 surface 의 chrome 색을 *섞지* 말 것 — 랜딩에서 `{colors.canvas-pure}` 흰 캔버스 직접 사용 금지, productivity 에서 `{colors.canvas}` 워밍 아이보리 사용 금지. 둘은 다른 페이지 카테고리에 속함.
- Drop shadow 도입 금지 (랜딩의 책 표지 / brand mark glow 단 2곳 제외). 카드는 페이지에 납작히. 깊이는 hairline 과 left-indicator 로만.
- `{colors.ink-2}`·`{colors.ink-3}` 등 near-black 으로 primary CTA 만들기 금지. Primary 는 정확히 `{colors.primary}` (`#3b82f6`) 또는 `{colors.ink}` (`#27272a`).
- 결과 카드 내부에 padding 두르기 금지. card-head / formula-stage / meta 가 각자 padding 책임.
- 한 row 에 두 개의 hero-tile / 두 개의 display 헤드라인 금지. 1 페이지 1 display tier.
- `{typography.link-md}` 외에 underline 금지. 버튼·헤딩·답·가격 etc. underline 없음.
- 세 가지 button shape 도입 금지. Pill (`button-*`) 또는 icon-circular (`button-icon-circular`) — 두 형태가 전부.
- 검증 시그널 색을 "톤·분위기" 용으로 사용 금지. coral 은 실패만, green 은 통과만, blue 는 primary action / concept badge 만.
- LaTeX 수식을 `{colors.canvas-pure}` 흰 배경 위에 직접 배치 금지. 항상 `{colors.soft-cloud}` formula-stage 안.
- `{component.brand-mark}` 의 그라데이션 + glow + 9px 반경은 다른 컴포넌트에서 재현 금지. 그 자리는 로고만의 자리.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| ultrawide | 1920px+ | 콘텐츠 max-width 1440 (landing) / 1280 (productivity) 유지. outer gutter 80px 까지 확장. |
| desktop-large | 1440px | 기본 — 3-up result grid, 4-up footer, 4-up feature-cell row, full primary-nav. |
| desktop | 1200px | 동일하되 outer gutter 약간 축소. |
| desktop-small | 1024px | result grid 2-up 으로 압축. feature-cell 2-up 으로. |
| tablet | 768~1023px | entry-grid 1-up, sub-nav 압축 (breadcrumb "←" 만), book-cover 92vw 로 축소. |
| mobile-landscape | 600~767px | 모든 grid 1-up. action-bar fixed bottom. |
| mobile | 320~599px | display-hero clamp 자동 축소 (48px 까지). primary-nav links 숨김. footline 2-col. |

### Touch Targets

모든 인터랙티브 요소는 WCAG AAA (44×44px). Pill button 44px height + 22px padding, icon-circular 40px + 48px hit area, filter-chip 36px + 16px hit area.

### Collapsing Strategy

- **Primary nav:** desktop full → tablet 에서 nav-links 숨김 / brand + CTA 만 → mobile drawer (캡스톤 1차 MVP 는 drawer 없이 brand + CTA 만 유지).
- **랜딩 book-stack:** desktop 640px stage → tablet 460px → mobile 92vw 책 표지.
- **랜딩 feature-strip:** 3-col → 1-col, 각 cell 의 border-right → border-bottom 으로 전환.
- **productivity result-grid:** 3-up → 2-up (1024) → 1-up (600).
- **productivity entry-grid:** 2-up → 1-up (768).
- **Section spacing:** `{spacing.section}` (48px) desktop → 32px tablet → 24px mobile.
- **Action bar:** desktop sticky → mobile fixed.

### Image Behavior

OpenMath 는 사진 없음. 수식 (LaTeX SVG) 은 viewport 비례 scale, 책 표지 (CSS gradient) 는 width 380px → 92vw 로 fluid. 떠다니는 토큰 (텍스트) 은 mobile 에서 6 개 → 3 개로 축소.

### Korean-specific

- `word-break: keep-all` + `overflow-wrap: break-word` body 기본.
- 한국어 라벨 가변 폭 고려, input·dropdown·chip min-width 만 보장.
- Pretendard 토큰 제거됨 — Noto Sans KR 로 통일. Fraunces 한국어 fallback 은 Noto Serif KR.

## Surfaces

OpenMath 의 가장 큰 단일 디자인 결정은 *두 surface 의 명시적 분리* 다.

### Editorial Surface

**사용처:** 랜딩 (`/`), 마케팅 페이지, 발표 자료, 외부 공개 화면.

**캔버스:** `{colors.canvas}` (`#fafaf9`) 워밍 아이보리.

**디스플레이 폰트:** `{typography.display-hero}` (Fraunces 96~104px), `{typography.heading-xl}` (Fraunces 32px).

**핵심 컴포넌트:** `{component.eyebrow}`, `{component.brand-mark}`, `{component.book-cover}`, `{component.floating-token}`, `{component.hint-pill}`, `{component.feature-cell}`, `{component.footline}`.

**Effect 허용:** backdrop-blur, radial-gradient wash, grid-pattern overlay, perspective transform, drop-shadow.

**Voice:** 학술적 · 신뢰감 · 책 같은 권위.

### Productivity Surface

**사용처:** 앱 내부 (`/app/*`), 출제 워크플로우 (S0~S6), 사용자가 *작업* 하는 모든 화면.

**캔버스:** `{colors.canvas-pure}` (`#ffffff`) 순백.

**디스플레이 폰트:** `{typography.display-section}` (Fraunces 72px) on `{colors.ink}` hero-tile — 단 한 자리.

**핵심 컴포넌트:** `{component.hero-tile-productivity}`, `{component.job-entry-card}`, `{component.result-card}`, `{component.formula-stage}`, `{component.step-progress-row}`, `{component.intent-checkbox}`, `{component.inline-notice-pass}`, `{component.action-bar-sticky}`.

**Effect 금지:** drop-shadow, backdrop-blur, gradient. 깊이는 hairline + left-indicator 만.

**Voice:** 정확 · 결정론적 · 검증 결과 노출.

### 공유 토큰

두 surface 가 동일하게 사용하는 토큰:
- 모든 spacing token (`{spacing.*}`)
- `{rounded.pill}`, `{rounded.none}`, `{rounded.sm}`, `{rounded.xs}`
- 모든 verification color (`{colors.pass*}`, `{colors.fail*}`, `{colors.concept*}`, `{colors.warn*}`)
- `{colors.primary}` (단, productivity 에서는 button-primary 한 자리만)
- `{colors.ink}`, `{colors.on-ink}`, `{colors.ink-2}`, `{colors.ink-3}`, `{colors.ink-4}`
- 모든 button 변형 (button-primary, button-ink, button-secondary, button-ghost)
- 모든 badge / inline-notice / filter-chip
- 모든 navigation 컴포넌트 (utility-bar, primary-nav, sub-nav, footer)

차이가 나는 토큰:
| Editorial | Productivity |
|---|---|
| `{colors.canvas}` (#fafaf9 warm ivory) | `{colors.canvas-pure}` (#ffffff) |
| `{colors.rule}` (#e7e5e0 warm) | `{colors.hairline}` (#cacacb cool) |
| `{component.book-cover}` (시리즈) | `{component.formula-stage}` (수식 stage) |
| Drop shadow (책 표지) 허용 | Drop shadow 금지 |
| `{typography.display-hero}` (clamp 48~104) | `{typography.display-section}` (72 fixed) |

## Iteration Guide

1. **한 컴포넌트씩 처리.** YAML front matter 의 component entry 하나씩 가져와 모든 property 가 토큰 참조인지 확인 (`{colors.*}`, `{typography.*}`, `{rounded.*}` 등). 인라인 hex / px 사용 금지.

2. **토큰 참조는 정확히.** `{colors.ink}` 처럼 dot path. `${...}` / `{{...}}` 형식 금지. 객체 참조는 `{typography.body-md}` 처럼 그룹명.

3. **두 surface 를 섞지 말 것.** 새 컴포넌트를 만들기 전에 *어느 surface 인지* 결정. 토큰 선택이 거기서 갈린다.

4. **검증 컬러는 의미만.** UI 에 coral / green / blue / amber 가 보이면 그것은 검증 시그널이거나 primary action 이거나 둘 중 하나. "분위기" 차용 발견 시 별개 토큰을 추가하라.

5. **새 variant 는 별도 component entry.** `-active`, `-disabled`, `-focused`, `-failed` etc. 인라인 prose 에 묻지 말 것. Nike 의 `button-primary-active` (transform/opacity) 패턴을 따른다.

6. **본문 기본은 `{typography.body-md}`.** form label·답·문항번호는 `{typography.body-strong}`, 랜딩 hero 는 `{typography.display-hero}`, 그 외 디스플레이는 `{typography.display-section}`/`{typography.heading-xl}`.

7. **`{colors.primary}` 는 viewport 당 희소하게.** 한 fold 에 blue solid pill 두 개 이상 → 하나는 `{component.button-secondary}` 또는 `{component.button-ghost}` 로 중화.

8. **새 컴포넌트 추가 전 자문.** 기존 pill + flat-card + formula-stage + step-row + book-cover 어휘로 표현 못 하는가? 가능하면 새 토큰 추가 X. 이 시스템의 강점은 *거의 항상 기존 토큰으로 충분* 함.

9. **수식은 항상 `{colors.soft-cloud}` 위.** 수식이 canvas-pure 흰 배경 위에 직접 놓이면 카드의 시각 구조가 무너진다.

10. **`npx @google/design.md lint DESIGN.md` 정기 실행.** `broken-ref` 는 error, `contrast-ratio` / `orphaned-tokens` / `missing-typography` / `section-order` 는 warning. lint 통과 = front matter 와 prose 의 토큰 참조가 모두 resolve 된다는 보증.

## Known Gaps

- **모달 / 다이얼로그:** 1차 MVP 는 풀-페이지 전환만, 모달 없음. PDF Confirm (S6) 도 풀-페이지로 처리. 추후 모달 도입 시 `{rounded.lg}` (24px) 예약.

- **Hover state:** 본 문서는 hover 미정의 (Nike 정책 동일). 실제 구현 시 `--om-color-X-hover` CSS 변수 또는 Tailwind utility 로 별도 정의 — 시스템 전체에 일관 적용 후 본 문서에 patch.

- **Dark mode:** 1차 MVP light only. 캡스톤 데모 후 검토. 다크 도입 시 `{colors.canvas}` 와 `{colors.canvas-pure}` 두 surface 각각 별개의 inverse 토큰 필요.

- **다국어:** Pretendard 제거됨 → Noto family fallback 으로 통일. 일본어·중국어 환경은 추후. RTL 미지원.

- **OCR 입력:** textarea-multiline 외 이미지 업로드 컴포넌트 미정의. 1차 MVP disabled state 로만 노출.

- **사용자 프로필 / 계정:** primary-nav 우측 cluster 가 1차 MVP 에서는 비어 있음 (button-primary 단 1개). 캡스톤 이후 D-3 결정 재검토 시 사용자 cluster 추가.

- **모바일 drawer:** 1차 MVP 의 mobile primary-nav 는 brand + CTA 만, drawer 미구현. 캡스톤 이후 hamburger drawer 도입.

- **랜딩 book-stack 모션 접근성:** mouse 기반 parallax 와 표지 flip 은 `prefers-reduced-motion: reduce` 시 모두 무효화되어야 함. 본 문서 작성 시점 미구현 — FE 구현 시 추가 필요.
