# Prompts

`packages/agent/prompts/*.md` — 각 LLM 호출에 사용되는 프롬프트.

## 포맷 (architecture.md D-8)

`.md` + YAML frontmatter. `prompt-loader.ts`가 frontmatter를 파싱해
Vercel AI SDK `generateObject({ model, temperature, system, schema })` 메타로 매핑한다.

### Frontmatter 필드

| 필드 | 필수 | 설명 |
|---|---|---|
| `id` | ✓ | 파일명과 일치 |
| `version` | ✓ | semver, A/B 테스트 기반 |
| `model` | ✓ | 기본 모델 (config/models.ts default를 override) |
| `temperature` | ✓ | 0.0 ~ 2.0 |
| `max_tokens` | | 응답 토큰 상한 |
| `schema` | | Zod schema 이름 (`schemas/index.ts`에서 export된 것) |
| `variables` | ✓ | 본문 `{{var}}` 자리에 들어갈 변수 이름 목록 |
| `owner` | ✓ | `[비할당]` 또는 담당자 |
| `updated` | ✓ | ISO 날짜 |

### Body

Markdown + Handlebars 변수 치환 (`{{intent.objective_code}}`, `{{#each refs}}...{{/each}}`).

## 파일 목록

| 파일 | 사용 step | 모델 권장 | 본질 |
|---|---|---|---|
| `intent-extraction.md` | 2 | 작고 빠른 (mini) | 구조화 추출 |
| `problem-generator.md` | 3 | 큰 (gpt-4o 등) | 창의적 생성 |
| `constraint-critic.md` | 3 (내부) | 작은 | 검수 |
| `refiner.md` | 3 (내부) | 큰 | 재생성 |
| `independent-solver.md` | 5 | 큰, temp=0 | 독립 풀이 |
| `objective-mapper.md` | 6 (보조) | 작은 | 보조 판정 |

## 변경 정책

이 디렉토리는 **[비할당]**이 매일 만지는 영역이다.

- frontmatter `version` 올리고 commit
- body 변경 시 영향 받는 step 메뉴얼 테스트 후 merge
- breaking 변경은 `prompt-loader` 호환성 깨지지 않는 한 자유

scaffolding 코드(`src/`)는 인터페이스가 안정적이므로, 프롬프트 변경만으로 동작이 바뀐다.
