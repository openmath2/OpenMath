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
| **Agent** | Node.js + Hono + OpenAI Agents SDK | Multi-agent orchestration, LLM tool-use, HTTP API |
| **Math Engine** | Python + FastAPI + SymPy | Symbolic verification, equation solving, calculus |

LLM access is pluggable: direct OpenAI or via [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) for unified Claude/GPT/Gemini routing.

## Development

```bash
pnpm install         # installs deps + git hooks (lefthook)
pnpm dev:all         # runs both services
pnpm test            # all tests (Node + Python)
```

- Agent: `http://localhost:3000`
- Math Engine: `http://localhost:8000`

```
packages/
├── agent/         # Node.js orchestration
└── math-engine/   # Python verification
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch strategy, hooks, and PR workflow.

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
