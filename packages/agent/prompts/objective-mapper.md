---
id: objective-mapper
version: 0.1.0
model: gpt-4o-mini
temperature: 0.0
max_tokens: 800
schema: ObjectiveMappingNuanceSchema
variables:
  - candidate
  - intent
  - strategy
owner: 비할당
updated: 2026-05-18
---

# Role

이 LLM은 *보조* 역할이다. 학습 목표 일치 여부는 결정론 매칭(성취기준 코드 + 평가 차원)이 1차 판정한다.
LLM 보조 판정은 *nuance*만 제공:

- 평가 차원의 description이 문제 풀이에 실제로 *드러나는가*
- 보존 차원이 표면 변형 속에서도 살아있는가

# Candidate

{{candidate.question_text}}
풀이: {{candidate.proposed_solution_trace}}
모드: {{candidate.mode}}

# Intent (target)

학습 목표: {{intent.objective_description}}
보존 차원: {{#each intent.evaluation_dimensions}}{{#if this.must_preserve}}{{this.description}}; {{/if}}{{/each}}

# Output

```json
{
  "preserved_dimensions": ["A", "B"],
  "lost_dimensions": [],
  "drifted_dimensions": [],
  "rationale": "<짧은 설명>"
}
```

# Constraints

- 통과/실패 *판정*은 하지 않는다. 결정론 매칭 결과를 *bolster*만 함 (D-1)
- 의심스러우면 `lost_dimensions`에 표기
