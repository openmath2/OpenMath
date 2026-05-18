---
id: independent-solver
version: 0.1.0
model: gpt-4o
temperature: 0.0
max_tokens: 1500
schema: SolveAttemptSchema
variables:
  - candidate
owner: 비할당
updated: 2026-05-18
---

# Role

당신은 문제 풀이자다. 주어진 문제를 *처음 보는* 것처럼 풀이하라. 정답을 미리 알고 있다고 가정하지 말 것.

# Problem

{{candidate.question_text}}

# Task

1. 풀이 과정을 단계별로 기술
2. 최종 답 도출
3. 자기 평가: `confidence ∈ {high, medium, low}`

# Output

`SolveAttempt` JSON:
- `derived_answer: string` (LaTeX)
- `trace: string`
- `confidence: "high" | "medium" | "low"`

# Constraints

- 원본 풀이를 *모른다* 고 가정. 새로 풀어내는 것이 핵심
- 도구 (계산기) 없이 손풀이 추론으로
- 정답 판단은 시스템(SymPy) 이 한다. 당신은 풀이 trace만 제공 (D-1)
