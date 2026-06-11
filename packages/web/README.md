# @openmath/web

OpenMath 프론트엔드 (Next.js 14 App Router + Tailwind v4).

랜딩 페이지 보일러플레이트 + [DESIGN.md](./DESIGN.md) 디자인 시스템 spec. 현재 `/`, `/login`, `/samples`, `/app/*` (S0~S6) 가 작동.

---

## 빠른 시작

```bash
pnpm install            # 루트에서 1회
pnpm -F @openmath/web dev    # http://localhost:27182
```

`agent` 서비스 (포트 31415) 가 동시에 떠 있어야 SSE 엔드포인트를 호출할 수 있다. `pnpm dev:all` 사용 권장.

## 디렉토리

```
packages/web/
├── DESIGN.md                  # 디자인 시스템 spec (Nike fork + Landing.html 융화)
├── app/
│   ├── layout.tsx             # root layout — Google Fonts CDN (Fraunces · Inter · Mono · Noto KR family)
│   ├── globals.css            # Tailwind v4 @theme + DESIGN.md tokens + landing CSS layer
│   └── page.tsx               # `/` 랜딩 composition
├── components/
│   └── landing/
│       ├── brand-mark.tsx     # 로고 svg + glow
│       ├── nav.tsx            # primary nav
│       ├── hero.tsx           # 카피 + 책 스테이지
│       ├── book-stage.tsx     # **client** — 3D 책 스택 + 떠다니는 토큰 (mouse parallax + idle drift)
│       ├── feature-strip.tsx  # 3-up feature row
│       └── footline.tsx       # copyright row
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs         # Tailwind v4
└── eslint.config.mjs
```

## 디자인 시스템

[`DESIGN.md`](./DESIGN.md) 는 `@google/design.md` 포맷으로 작성된 듀얼-서피스 디자인 시스템 spec.

- **Editorial Surface** (`/` 랜딩, 마케팅) — `{colors.canvas}` warm ivory + Fraunces serif + book stack + floating tokens + primary blue.
- **Productivity Surface** (`/app/*` 출제 도구) — `{colors.canvas-pure}` 순백 + Pretendard fallback Inter + 검증 시그널 컬러 + flat 카드.

두 서피스가 같은 token set 위에서 다른 surface 만 가짐. 새 컴포넌트 추가 전 `DESIGN.md` §10 *Iteration Guide* 9 단계 확인.

```bash
npx @google/design.md lint DESIGN.md
```

`broken-ref` 는 error, 나머지는 warning. lint 통과 = front matter 와 prose 의 토큰 참조가 모두 resolve 됨.

## SSE Consumption

`agent` 의 `POST /api/generate` 가 6 단계 검증 progress 를 SSE 로 흘림. 현재 구현됨 (`hooks/use-verification-stream.ts`).

**중요**: 브라우저 `EventSource` 는 GET 전용. `POST /api/generate` 와 호환되지 않음. 두 가지 선택지:
- (A) **`@microsoft/fetch-event-source`** 사용 — production 패턴 (OpenDerisk, Openinary, Kodus AI 채택). custom hook `hooks/use-verification-stream.ts` 안에 `fetchEventSource` 래핑 + `AbortController` cleanup.
- (B) `agent` 측에서 `GET /api/generate?…` 로 변경 — 표준 `EventSource` 사용 가능.

현재 구현은 (A) `@microsoft/fetch-event-source` 채택. `useChat` (Vercel AI SDK) 은 AI SDK 의 `data-*` 메시지 스트림 프로토콜 전용이라 임의 SSE 이벤트 이름 (`step_started`, `pipeline_completed`) 과 호환 안 됨.

이벤트 종류 (`docs/specs/architecture.md` D-6):
- `step` — `{ index: 1-6, name: string, status: 'started' | 'completed' | 'failed' | 'unverified', summary?: string }`
  - `summary` 는 성공 시에도 단계 서사가 온다 (예: `후보 생성 (gpt-5.5) · Critic 1라운드 · 3.2초`)
  - `unverified` = 결정론 검증 불가 (실패 아님; 독립 재풀이로만 확인)
- `preview` — `{ latex: string }` (3/6 완료 직후 후보 문제 미리보기)
- `attempt` — `{ attempt, max_attempts, reason }` (검증 실패로 재생성 시작; FE 는 3~6 단계 리셋)
- `runs` — `{ completed, total }` (병렬 생성 런 집계; count > 1 일 때만)
- `result` — `GeneratedProblem[]` (검증 통과한 문항 묶음)
- `error` — `{ stage: string, message: string }`

구현 내역:
- `hooks/use-verification-stream.ts` (`fetchEventSource` + `AbortController` cleanup) — 구현 완료
- React 18 strict-mode 더블 마운트 방어 (cleanup 함수)
- `agent` 측 CORS 설정 (`Access-Control-Allow-Origin: http://localhost:27182`)
- `@openmath/agent` 워크스페이스 dep 추가 + Zod 스키마 import (`@openmath/agent/schemas`)

## 폰트 로딩

`<link>` 직접 (`app/layout.tsx`) — `next/font/google` 대신. 이유:
1. Landing.html 과 1:1 호환
2. Noto Serif KR / Noto Sans KR 의 large file 을 build 에 포함 안 함
3. Korean subset 처리 단순

향후 LCP 최적화 필요 시 `next/font/local` 로 자가 호스팅 검토.

## Tailwind v4

CSS-first config. JS config 파일 없음. 모든 디자인 토큰은 `app/globals.css` 의 `@theme {}` 블록 안에 CSS variable 로 정의되어, 그대로 Tailwind utility 가 됨 (예: `bg-canvas`, `text-ink-3`, `rounded-pill`).

## 작업 배분 & 진행 상태

| 영역 | 담당 | 상태 |
|---|---|---|
| boilerplate (Landing 1 화면) | **[본인]** | ✅ |
| `/` 랜딩 추가 컴포넌트 (footer 3-col, FAQ, iPad showcase) | **[비할당]** | ✅ |
| 앱 내부 화면 (S0 ~ S6) 마이그레이션 | **[비할당]** | ✅ |
| SSE consumption hook (`hooks/use-verification-stream.ts`) | **[비할당]** | ✅ |
| KaTeX 수식 렌더링 컴포넌트 (`components/math/latex-renderer.tsx`) | **[비할당]** | ✅ |
| `prefers-reduced-motion` CSS 규칙 적용 (book-stack 모션 + S4 spinner + intent cards 등) | **[비할당]** | ✅ |
| `prefers-reduced-motion` 실 OS 토글 QA | **[비할당]** | ⚠️ 미수행 (CSS 만 적용) |
| `/login`, `/samples` 추가 페이지 (스펙 외, UX 보강) | **[비할당]** | ✅ |

자세한 우선순위는 루트 [`AGENTS.md`](../../AGENTS.md) §9 참조.

## 라우트 맵

| 경로 | 화면 | Surface | 상태 |
|---|---|---|---|
| `/` | Landing (Hero + FAQ + Footer + iPad showcase) | editorial | ✅ |
| `/login` | 로그인 폼 | editorial | ⚠️ mock (실제 인증 없음 — 제출 시 `/app` 로 라우팅) |
| `/samples` | 검증 통과 예시 3 문항 | editorial | ✅ |
| `/app` | S0 워크스페이스 (hero-tile + entry cards) | productivity | ✅ |
| `/app/new/grade` | S1 학년 선택 | productivity | ✅ |
| `/app/new/topic` | S2 단원 선택 (30 단원 정적 데이터) | productivity | ✅ |
| `/app/new/intent` | S3 동형 모드 + 평가 차원 | productivity | ✅ |
| `/app/new/verify` | S4 검증 6 단계 진행 (SSE) | productivity | ✅ |
| `/app/new/result` | S5 결과 + 채택 | productivity | ⚠️ mock 데이터 (`app/new/result/mock.ts` — agent 미연동) |
| `/app/new/export` | S6 PDF 출력 (브라우저 print API) | productivity | ⚠️ mock 데이터 기반 |

`mock.ts` 는 URL params (grade/topic/mode/dims/adopted) 로부터 결정적 mock 문항 4 종 (pass / pass-mixed / warn / fail) 을 생성. agent SSE 응답 연동 시 본 모듈을 fetch + parse 호출로 교체.

## 새 dependencies

| 패키지 | 버전 | 용도 |
|---|---|---|
| `@microsoft/fetch-event-source` | ^2.0.1 | S4 SSE 수신 (`POST + AbortController` cleanup 지원, 표준 `EventSource` 가 못하는 헤더/메서드 처리) |
| `katex` | ^0.16.x | LaTeX 수식 렌더 (SSR — `renderToString`, MathML fallback 으로 SR 의미 운반) |
| `@types/katex` | ^0.16.x | TS 타입 |

## 관련 문서

- [`../../docs/specs/architecture.md`](../../docs/specs/architecture.md) — L0 결정 (D-9: 프론트엔드)
- [`../../docs/specs/domain.md`](../../docs/specs/domain.md) — L1 도메인
- [`../../docs/product/`](../../docs/product/) — 사용자 측 기획 (USER_FLOW, SCREENS, MOCKUPS)
- [`../../docs/product/DESIGN.md`](../../docs/product/DESIGN.md) — superseded historical (productivity-only)
