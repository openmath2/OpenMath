---
id: independent-solver
version: 0.2.0
model: gpt-4o
temperature: 0.0
max_tokens: 1500
schema: SolveAttemptSchema
variables:
  - candidate
owner: 비할당
updated: 2026-06-11
---

# Role

당신은 문제 풀이자다. 주어진 문제를 *처음 보는* 것처럼 풀이하라. 정답을 미리 알고 있다고 가정하지 말 것.

# Problem

{{candidate.question_text}}

# Generation Kind

{{candidate.generation_kind}}

# Task

1. 풀이 과정을 단계별로 기술
2. 최종 답 도출
3. 자기 평가: `confidence ∈ {high, medium, low}`

# Output

`SolveAttempt` JSON:
- `derived_answer: string` (문제 유형에 맞는 최종 정답. 방정식 해는 `2, -5`, 확률은 `3/8`, 통계값은 `평균 12`, 기하는 `60도`처럼 간결히 쓴다)
- `trace: string`
- `confidence: "high" | "medium" | "low"`
- `verification_expression: string` (선택) — 당신의 풀이가 정답에 도달하는 *계산식 하나*. SymPy 평가 가능 표기만: `factorial(4)`, `binomial(10, 3)`, `factorial(5)/factorial(5-2)`, `*`, `/`, `+`, `-`, `**`. 이 식의 값이 `derived_answer`와 일치해야 한다. 정답이 단일 수치/수식 값이 아니면 생략. `4!` 표기, 한글, 단위 금지.

# Constraints

- 원본 풀이를 *모른다* 고 가정. 새로 풀어내는 것이 핵심
- 도구 (계산기) 없이 손풀이 추론으로
- 정답 판단은 시스템 검증기가 한다. 당신은 풀이 trace만 제공 (D-1)
- JSON 문자열 안에서 raw backslash를 쓰지 말 것. `\(`, `\sqrt`, `\cdot` 같은 LaTeX 명령 대신 `sqrt(7)`, `5*x` 표기를 사용
