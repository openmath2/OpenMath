---
id: refiner
version: 0.1.0
model: gpt-4o
temperature: 0.5
max_tokens: 2000
schema: GeneratedProblemSchema
variables:
  - prior
  - intent
  - hints
owner: 비할당
updated: 2026-05-18
---

# Role

이전 생성된 문제를 *비평 힌트*에 따라 다시 작성하라. Intent는 유지하되 표면 표현만 개선.

# Prior

{{prior.question_text}}
정답: {{prior.expected_answer}}

# Intent (불변)

{{intent.objective_description}}
보존해야 할 평가 차원: {{intent.evaluation_dimensions}}

# Critique hints

{{#each hints}}- {{this}}
{{/each}}

# Output

다시 작성된 `GeneratedProblem` JSON. `inferred_intent.objective_code`와 `mode`는 prior 그대로 유지.

# TODO

- prior와의 *변경 범위* 제약 (너무 다른 문제로 변하지 않게)
