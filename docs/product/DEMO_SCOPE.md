# Demo Scope

Status: active for capstone demo
Last updated: 2026-05-31

This document records the units OpenMath treats as demo-safe. The goal is not to
claim full curriculum coverage yet, but to make the capstone path predictable:
RAG references exist, strategy YAML exists, and the verification pipeline can
produce a result event.

## Primary 5-minute demo

Use this flow for the main presentation:

1. Grade: middle 1
2. Unit: `9수02-03` 일차방정식
3. Mode: `auto`
4. Count: 2-5
5. Expected behavior: structural and conceptual attempts alternate, each runs
   through RAG, intent, generation, SymPy verification, independent re-solve,
   objective mapping, and final result streaming.

Why this unit:

- The corpus has multiple equation-style references.
- `math-engine /solve` handles the generated linear equations directly.
- The strategy is simple enough to explain in a short judge-facing demo.
- The output is easy to inspect visually on the result screen.

## Secondary demo-safe units

These units have strategy YAML in `packages/agent/data/achievement-standards/`
and are suitable for fallback or comparison demos:

| Code | Unit | Grade | Demo note |
|---|---|---:|---|
| `9수01-05` | 제곱근과 실수 | 3 | Good for concept preservation examples |
| `9수02-07` | 연립일차방정식 | 2 | `/solve` now supports equation systems |
| `9수02-09` | 이차방정식 | 3 | Best for factoring and LaTeX rendering |

## Broader strategy coverage

The current strategy set covers 12 units:

`9수01-01`, `9수01-05`, `9수02-01`, `9수02-03`, `9수02-06`, `9수02-07`,
`9수02-08`, `9수02-09`, `9수02-10`, `9수03-02`, `9수03-04`, `9수04-05`.

These are enough for UI exploration and workflow tests. Production-quality
coverage still depends on corpus density and LLM output quality for each unit.

## Known limits

- Without `LLM_API_KEY` or `LLM_BASE_URL`, the agent uses the local fallback
  generator. That verifies the pipeline shape, not final content quality.
- Some units can retrieve broader neighboring references when exact corpus
  density is low.
- `mode: auto` is defined as alternating structural and conceptual attempts.
  It does not rank the two modes yet.
