# Contributing

OpenMath은 PR 기반 개발 흐름을 따른다. main 브랜치에 직접 푸시하지 않는다.

## 초기 설정

```bash
pnpm install
```

`pnpm install` 시 lefthook이 자동으로 git hooks를 설치한다. 이후 commit/push 시 다음이 자동 실행된다:

| 시점 | 검사 |
|------|------|
| `pre-commit` | 변경된 TS 파일 typecheck, 변경된 Python 파일 ruff lint |
| `pre-push` | main 브랜치 직접 push 차단, Node/Python 전체 테스트 |
| `commit-msg` | 커밋 메시지 첫 줄 72자 이하 |

hook을 우회해야 할 정당한 사유가 있으면 `--no-verify` 사용. 단, 이는 예외 상황에만.

## 브랜치 전략

```
main                            # 항상 배포 가능한 상태
├── feat/<scope>-<short-name>   # 새 기능
├── fix/<scope>-<short-name>    # 버그 수정
├── chore/<scope>-<name>        # 리팩토링, 설정, 의존성
└── docs/<name>                 # 문서 변경
```

예시:
- `feat/agent-curriculum-strategy-loader`
- `fix/math-engine-rational-parsing`
- `chore/ci-add-coverage-upload`

## 작업 흐름

1. main에서 새 브랜치 분기
2. 작업 + 테스트
3. 로컬 검증 통과 확인
   ```bash
   pnpm -F @openmath/agent typecheck
   pnpm -F @openmath/agent test
   cd packages/math-engine && uv run pytest
   ```
4. push 후 PR 생성
5. CI 통과 + 1인 이상 리뷰 후 merge

## 커밋 메시지

명령형 영어. 첫 줄은 50자 이내, 본문은 한국어 OK.

```
Add curriculum strategy YAML loader

[9수XX-YY] 형식의 성취기준코드를 파싱하고
대응되는 출제 전략 YAML 을 메모리에 캐싱한다.
```

## 코드 스타일

- TypeScript: `strict: true`. `as any`, `@ts-ignore` 금지.
- Python: ruff (`E`, `F`, `I`, `UP` 룰셋).
- 주석은 코드로 표현 못하는 의도/제약/수학식만.

## 테스트 정책

- 새 기능 → 단위 테스트 동반
- 외부 시스템 통합 → integration 테스트
- 버그 수정 → 회귀 테스트 추가

## CI

PR 마다 다음이 자동 실행된다:

- `node-tests`: typecheck + vitest unit
- `python-tests`: ruff + pytest
- `integration-tests`: 실제 Python 서버 spawn 후 e2e

전부 통과해야 merge 가능.

## Branch Protection

`main` 브랜치는 GitHub 측에서도 보호된다:

- PR 없이 직접 push 불가 (admin bypass 제외)
- CI 전부 통과 필수
- 1인 이상 review approval 필요
- force push, branch 삭제 금지

로컬 git hook은 1차 방어선이고, GitHub branch protection이 최종 차단선이다.
