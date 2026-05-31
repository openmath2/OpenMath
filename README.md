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
