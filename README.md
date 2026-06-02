```
  ___                   __  __       _   _
 / _ \ _ __   ___ _ __ |  \/  | __ _| |_| |__
| | | | '_ \ / _ \ '_ \| |\/| |/ _` | __| '_ \
| |_| | |_) |  __/ | | | |  | | (_| | |_| | |
 \___/| .__/ \___|_| |_|_|  |_|\__,_|\__|_| |_|
      |_|
```

**Generate mathematically verified math problems — powered by AI, validated by SymPy.**

[![Status](https://img.shields.io/badge/Status-In%20Development-yellow.svg)]()
[![Node.js](https://img.shields.io/badge/Agent-Node.js-339933.svg?logo=node.js&logoColor=white)]()
[![Python](https://img.shields.io/badge/Math%20Engine-Python-3776AB.svg?logo=python&logoColor=white)]()

---

OpenMath generates *isomorphic math problems* — same mathematical approach, different appearance — for Korean middle school curricula (Grades 7–9, 2022 Revised Curriculum).

LLMs produce plausible math problems with wrong solutions ([MathTrap300](https://openreview.net/forum?id=Urs8lNvMXB)). OpenMath separates generation from verification: LLMs create, SymPy proves.

## Goals

- **Mathematically correct generation** — Every problem verified by symbolic computation, never by another LLM
- **True isomorphic problems** — Same approach, different surface; not just number swaps
- **Curriculum-aligned** — Grounded in 2022 Revised Curriculum achievement standards

## Architecture

| Service | Stack | Role |
|---------|-------|------|
| **Agent** | Node 22 + Hono + Vercel AI SDK + Zod | Verification pipeline orchestration, LLM tool-use, SSE-streamed HTTP API |
| **Math Engine** | Python 3.11 + FastAPI + SymPy | Symbolic verification, equation solving, calculus |
| **Web** | Node 22 + Next.js 14 App Router + Tailwind v4 | Landing + 출제 워크플로우 UI. SSE consumer of `agent` |

검증 흐름은 결정론적 6단계 파이프라인 (RAG → Intent → Generate → SymPy → Re-solve → Objective map). LLM은 생성 단계와 독립 재풀이 단계에만 관여하고, 정답 판정은 결코 하지 않는다 — 자세한 결정 근거는 [`docs/specs/architecture.md`](docs/specs/architecture.md), 도메인 개념은 [`docs/specs/domain.md`](docs/specs/domain.md). 프론트 디자인 시스템은 [`packages/web/DESIGN.md`](packages/web/DESIGN.md) (editorial + productivity 듀얼-서피스).
캡스톤 시연 범위는 [`docs/product/DEMO_SCOPE.md`](docs/product/DEMO_SCOPE.md)에 고정한다.

LLM access is pluggable: direct OpenAI/Anthropic, or via [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) for unified Claude/GPT/Gemini routing.

## Status

- **`math-engine`** — operational. 5 endpoints (`/solve`, `/verify`, `/simplify`, `/differentiate`, `/limit`) + 19 pytest passing.
- **`agent`** — scaffolded per spec; 42 TS files with stable interfaces + Zod schemas. Implementations pending (search `throw new Error(".*: not implemented yet")`).
- **`web`** — Landing page + DESIGN.md spec scaffolded. `pnpm build` green, static prerender. 추가 화면 (S0~S6) 마이그레이션은 FE 담당.
- **L0 architecture** — Proposed (D-1 ~ D-9). **L1 domain** — Draft. L2 contracts·L3 modules: TBD.

## Development

```bash
pnpm install         # installs workspace deps + husky git hooks
pnpm dev:all         # runs all three services (agent · math · web)
pnpm test            # Node vitest + Python pytest
pnpm typecheck       # tsc --noEmit on agent + web
pnpm build           # production build (agent + web)
```

- Agent: `http://localhost:3000` (SSE at `POST /api/generate`)
- Math Engine: `http://localhost:8000`
- Web: `http://localhost:3001` (landing)

### LLM 환경 설정 (필수)

**⚠ LLM 환경 없이는 생성·검증이 100% 실패합니다** — seed fallback은 RAG 원본을 그대로 후보로 반환하므로 `objective_map`의 `not_transformed` 가드에 걸립니다.

다음 3가지 중 하나를 설정하세요. 모두 `packages/agent/.env` (또는 환경변수)로 주입.

#### 옵션 1 — CLIProxyAPI (Claude/GPT/Gemini 통합 라우터, 권장)

[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)를 로컬에서 실행하면 Claude·GPT·Gemini를 OpenAI 호환 API 하나로 라우팅 가능.

```bash
LLM_PROVIDER=cliproxy
LLM_BASE_URL=http://localhost:8317/v1
LLM_API_KEY=dummy-key
LLM_MODEL=gpt-4o   # 또는 claude-3-5-sonnet, gemini-2.0-flash
```

**Trade-off**: 로컬 라우터 별도 실행 필요. 캐시·모델 비교에 유리.

#### 옵션 2 — OpenAI 직접

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

**Trade-off**: 가장 빠른 setup. 비용은 사용량 기반.

#### 옵션 3 — Anthropic via OpenAI-compatible 호환 레이어

```bash
LLM_PROVIDER=anthropic-via-compatible
LLM_BASE_URL=<your-anthropic-compatible-endpoint>
LLM_API_KEY=...
LLM_MODEL=claude-3-5-sonnet-20241022
```

**Trade-off**: 별도 호환 layer 필요 (예: LiteLLM proxy). Claude의 수학 추론 품질 활용.

### 포트 충돌 회피

다른 프로세스(Mantis, 별도 Next.js 서버 등)가 3000번을 점유하면 `pnpm dev:all` 시 agent가 `EADDRINUSE`로 실패. 다음 단계로 회피:

```bash
# 1. 충돌 확인
lsof -i :3000

# 2. agent 포트 변경
PORT=3002 pnpm dev

# 3. web도 다른 포트의 agent를 보도록 변경
# packages/web/.env.local 생성:
echo "NEXT_PUBLIC_AGENT_URL=http://localhost:3002" > packages/web/.env.local

# 4. web 재기동
pnpm -F @openmath/web dev
```

`NEXT_PUBLIC_AGENT_URL`이 미설정이면 web은 `http://localhost:3000`을 호출하므로 포트 변경 시 반드시 `.env.local` 갱신.

### 데모 실행 절차 (캡스톤)

기본 데모 시나리오: **중3 / 이차방정식 (9수02-09) / 구조 동형 / 3문항** (OM-104 결정).

```bash
# 1. (한 번) deps + LLM 환경 + corpus 확인
pnpm install
cp packages/agent/.env.example packages/agent/.env
# .env 의 LLM_* 채우기

# 2. (매 시연) 세 서비스 기동
pnpm dev:all

# 3. (브라우저) http://localhost:3001 → S0 → 학년(중3) → 단원(이차방정식)
#    → 평가 차원(인수분해 또는 근의 공식 사용 + 판별식) → 생성

# 4. (검증) S4 6단계 ✓ → S5 결과 3문항 → S6 PDF
```

또는 직접 SSE:

```bash
curl -sN -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"grade":3,"topic":"9수02-09","mode":"structural","dims":["인수분해 또는 근의 공식 사용","판별식으로 해의 종류 해석"]}'
```

```
packages/
├── agent/                      # Node 22 — verification pipeline + HTTP/SSE
│   ├── src/
│   │   ├── schemas/            # Zod schemas — domain types + invariant guards
│   │   ├── tools/              # math-engine, RAG, prompt-loader, llm-provider
│   │   ├── agents/             # Generator · Critic · Refiner · Solver
│   │   ├── steps/              # 6-step pipeline functions
│   │   ├── workflows/          # Orchestrator (async generator → SSE)
│   │   ├── server/             # Hono app + routes
│   │   ├── policies/           # retry · timeout · acceptance
│   │   └── config/             # env + default models
│   ├── prompts/                # .md + YAML frontmatter — hand-off slot
│   └── data/                   # corpus JSONL + strategy YAML — hand-off slot
├── math-engine/                # Python — SymPy verification HTTP
│   ├── src/                    # FastAPI app + routers
│   └── tests/                  # pytest (19 tests)
└── web/                        # Node 22 — Next.js 14 App Router + Tailwind v4
    ├── DESIGN.md               # 디자인 시스템 spec (editorial + productivity 듀얼-서피스)
    ├── app/
    │   ├── layout.tsx          # root layout + Google Fonts (Fraunces · Inter · Noto KR · Mono)
    │   ├── globals.css         # Tailwind v4 @theme + DESIGN.md tokens
    │   └── page.tsx            # `/` 랜딩 composition
    └── components/landing/     # nav · hero · book-stage · feature-strip · footline
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch strategy, hooks, and PR workflow.
See [AGENTS.md](AGENTS.md) for codebase navigation, conventions, and command cheatsheet.

## Team

CAU Capstone Design Team 3.

| Member | Role |
|--------|------|
| **이주형** | Project Lead / Full-stack |
| **이동민** | Agent System |
| **한진우** | Generation Pipeline |

## References

- Kim et al. "[Computational Blueprints: Generating Isomorphic Mathematics Problems with LLMs](https://arxiv.org/abs/2511.07932)" — EMNLP 2025
- Christ et al. "[EDUMATH: Generating Standards-aligned Educational Math Word Problems](https://arxiv.org/abs/2510.06965)" — arXiv 2025
- Chen et al. "[LLMs Fail to Recognize Mathematical Unsolvability](https://openreview.net/forum?id=Urs8lNvMXB)" — arXiv 2025
- Alexander et al. "[Semantic Search over 9 Million Mathematical Theorems](https://arxiv.org/abs/2602.05216)" — ICLR 2026 Workshop

## License

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — non-commercial use with attribution.
