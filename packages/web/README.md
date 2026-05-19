# @openmath/web

OpenMath 프론트엔드 (Next.js 14 App Router + Tailwind v4).

랜딩 페이지 보일러플레이트 + [DESIGN.md](./DESIGN.md) 디자인 시스템 spec. 1차 핸드오프 시점에는 `/` 랜딩 1 화면만 작동.

---

## 빠른 시작

```bash
pnpm install            # 루트에서 1회
pnpm -F @openmath/web dev    # http://localhost:3001
```

`agent` 서비스 (포트 3000) 가 동시에 떠 있어야 SSE 엔드포인트를 호출할 수 있다. `pnpm dev:all` 사용 권장.

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

## SSE Consumption (후속 PR)

`agent` 의 `POST /api/generate` 가 6 단계 검증 progress 를 SSE 로 흘림. 1차 핸드오프에는 미포함.

**중요**: 브라우저 `EventSource` 는 GET 전용. `POST /api/generate` 와 호환되지 않음. 두 가지 선택지:
- (A) **`@microsoft/fetch-event-source`** 사용 — production 패턴 (OpenDerisk, Openinary, Kodus AI 채택). custom hook `hooks/use-verification-stream.ts` 안에 `fetchEventSource` 래핑 + `AbortController` cleanup.
- (B) `agent` 측에서 `GET /api/generate?…` 로 변경 — 표준 `EventSource` 사용 가능.

후속 PR 에서 (A) 채택 잠정. `useChat` (Vercel AI SDK) 은 AI SDK 의 `data-*` 메시지 스트림 프로토콜 전용이라 임의 SSE 이벤트 이름 (`step_started`, `pipeline_completed`) 과 호환 안 됨.

이벤트 종류 (`docs/specs/architecture.md` D-6):
- `step` — `{ index: 1-6, name: string, status: 'started' | 'completed' | 'failed' }`
- `result` — `GeneratedProblem[]` (검증 통과한 문항 묶음)
- `error` — `{ stage: string, message: string }`

후속 PR scope:
- `lib/sse-client.ts` + `hooks/use-verification-stream.ts` (`fetchEventSource` + `AbortController` cleanup)
- React 18 strict-mode 더블 마운트 방어 (cleanup 함수)
- `agent` 측 CORS 설정 (`Access-Control-Allow-Origin: http://localhost:3001`)
- `@openmath/agent` 워크스페이스 dep 추가 + Zod 스키마 import (`@openmath/agent/schemas`)

## 폰트 로딩

`<link>` 직접 (`app/layout.tsx`) — `next/font/google` 대신. 이유:
1. Landing.html 과 1:1 호환
2. Noto Serif KR / Noto Sans KR 의 large file 을 build 에 포함 안 함
3. Korean subset 처리 단순

향후 LCP 최적화 필요 시 `next/font/local` 로 자가 호스팅 검토.

## Tailwind v4

CSS-first config. JS config 파일 없음. 모든 디자인 토큰은 `app/globals.css` 의 `@theme {}` 블록 안에 CSS variable 로 정의되어, 그대로 Tailwind utility 가 됨 (예: `bg-canvas`, `text-ink-3`, `rounded-pill`).

## 작업 배분

| 영역 | 담당 |
|---|---|
| boilerplate (이 PR) | **[본인]** |
| `/` 랜딩 추가 컴포넌트 (footer 4-col, FAQ, etc) | **[비할당]** |
| 앱 내부 화면 (S0 ~ S6) 마이그레이션 | **[비할당]** |
| SSE consumption hook | **[비할당]** |
| KaTeX 수식 렌더링 컴포넌트 | **[비할당]** |
| `prefers-reduced-motion` 정밀 검증 | **[비할당]** |

자세한 우선순위는 루트 [`AGENTS.md`](../../AGENTS.md) §9 참조.

## 관련 문서

- [`../../docs/specs/architecture.md`](../../docs/specs/architecture.md) — L0 결정 (D-9: 프론트엔드)
- [`../../docs/specs/domain.md`](../../docs/specs/domain.md) — L1 도메인
- [`../../docs/product/`](../../docs/product/) — 사용자 측 기획 (USER_FLOW, SCREENS, MOCKUPS)
- [`../../docs/product/DESIGN.md`](../../docs/product/DESIGN.md) — superseded historical (productivity-only)
