```
  ___                   __  __       _   _
 / _ \ _ __   ___ _ __ |  \/  | __ _| |_| |__
| | | | '_ \ / _ \ '_ \| |\/| |/ _` | __| '_ \
| |_| | |_) |  __/ | | | |  | | (_| | |_| | |
 \___/| .__/ \___|_| |_|_|  |_|\__,_|\__|_| |_|
      |_|
```

**Generate mathematically verified math problems — powered by AI, validated by SymPy.**

[![Status: In Development](https://img.shields.io/badge/Status-In%20Development-yellow.svg)]()
[![Python](https://img.shields.io/badge/Backend-Python-3776AB.svg?logo=python&logoColor=white)]()
[![TypeScript](https://img.shields.io/badge/Frontend-TypeScript-3178C6.svg?logo=typescript&logoColor=white)]()

---

OpenMath is an AI system that generates *isomorphic math problems* — problems that look different but require the same mathematical approach — for Korean middle school curricula (Grades 7–9, 2022 Revised Curriculum). Instead of trusting LLMs to get math right, OpenMath separates generation from verification: LLMs create problems, and a multi-layer symbolic engine proves they're correct.

> **Why not just use ChatGPT?** LLMs produce plausible-looking math problems, but the solutions are frequently wrong — contradictory conditions, multiple answers, or plain arithmetic errors. Studies show LLMs can't even detect when a problem is unsolvable ([MathTrap300](https://openreview.net/forum?id=Urs8lNvMXB)). OpenMath fixes this by never letting the generator grade its own homework.

## Goals

- **Mathematically correct generation** — Every generated problem is verified by symbolic computation (SymPy), not by asking another LLM to "check"
- **True isomorphic problems** — Same mathematical approach, different appearance; not just swapping numbers
- **Curriculum-aligned** — Grounded in Korea's 2022 Revised Curriculum achievement standards (Grades 7–9)
- **Hybrid search over real exam data** — Find reference problems by mathematical essence, not surface-level text similarity
- **Separation of generation and verification** — The model that creates the problem never judges its own output
- **Classroom-ready output** — PDF exam sheets and answer keys that teachers can use directly

## Data Sources

| Source | Volume | Content |
|--------|--------|---------|
| [AI Hub](https://aihub.or.kr/) — Math Problem Generation | ~84,000 | Problems with curriculum metadata |
| [AI Hub](https://aihub.or.kr/) — Auto-Solving | ~34,000 | Step-by-step solutions |
| [AI Hub](https://aihub.or.kr/) — Problem-Solving Process | ~20,000 | Detailed solving workflows |
| Regional exam archives + CSAT | ~10,000 | OCR-structured exam problems |

## Team

Built by **CAU Capstone Design Team 3** at Chung-Ang University.

| Member | Role |
|--------|------|
| **이주형** | Project Lead / Full-stack — architecture, API, frontend, integration |
| **이동민** | Agent System — verification agents, multi-agent orchestration, SymPy tooling |
| **한진우** | Generation Pipeline — RAG search, problem generation, curriculum strategy design |

## Roadmap

- [ ] Core generation–verification pipeline
- [ ] RAG hybrid search with curriculum metadata
- [ ] SymPy tool-use integration for solver agents
- [ ] Web UI for problem generation
- [ ] PDF export (exam sheets + answer keys)
- [ ] Expand curriculum strategies beyond core units
- [ ] Quality metrics dashboard (pass rate, error analysis)
- [ ] Public API for third-party integrations

## References

- Kim et al. "[Computational Blueprints: Generating Isomorphic Mathematics Problems with LLMs](https://arxiv.org/abs/2511.07932)" — EMNLP 2025 Industry Track
- Christ et al. "[EDUMATH: Generating Standards-aligned Educational Math Word Problems](https://arxiv.org/abs/2510.06965)" — arXiv 2025
- Chen et al. "[LLMs Fail to Recognize Mathematical Unsolvability](https://openreview.net/forum?id=Urs8lNvMXB)" — arXiv 2025
- Alexander et al. "[Semantic Search over 9 Million Mathematical Theorems](https://arxiv.org/abs/2602.05216)" — ICLR 2026 Workshop

## License

This project is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — free to use and modify for non-commercial purposes with attribution.
