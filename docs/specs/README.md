# OpenMath Specifications

이 디렉토리는 OpenMath의 **결정(decisions)** 을 기록한다. 코드보다 spec이 먼저 온다.
모든 코드 한 줄에는 "왜 이렇게 짰는가"가 이 디렉토리 어딘가에 있어야 한다.

## 작성 원칙

1. **결정에는 항상 "왜?"가 있다.** "왜?"가 없는 항목은 spec이 아니라 메모다.
2. **모르는 것은 비워둔다.** 추측으로 채우지 않고 `## Open Questions`에 명시한다.
3. **반례가 보이면 즉시 갱신한다.** spec과 코드가 어긋난 채로 두지 않는다.
4. **위에서 아래로.** 상위 레이어가 결정되지 않은 채 하위 레이어를 쓰지 않는다.

## 레이어

| 레이어 | 파일 | 다루는 것 |
|---|---|---|
| L0 | `architecture.md` | 시스템 경계, 컴포넌트, 통신 위상, 실패 모드, 비기능 요구 |
| L1 | `domain.md` (TBD) | 도메인 개념(Problem, Solution, Verification, Strategy 등)과 불변식 |
| L2 | `contracts.md` (TBD) | HTTP/agent-tool 인터페이스 계약 |
| L3 | `modules/<name>.md` (TBD) | 개별 모듈/함수의 의무·전후조건 |

상위 레이어가 `Draft` 이상이어야 그 아래 레이어를 쓸 자격이 생긴다.

## 상태 라벨

각 spec 문서 최상단에 명시한다.

- `Draft` — 작성 중. 결정이 비어 있을 수 있음.
- `Proposed` — 모든 칸이 채워졌고 리뷰 요청 가능.
- `Accepted` — 합의됨. 이 시점부터 코드가 따라야 한다.
- `Implemented` — 코드가 spec과 일치함을 확인.
- `Superseded by <file>` — 다른 문서로 대체됨. 본문은 보존.

## 변경 절차

| 변경 종류 | 절차 |
|---|---|
| 오타·형식 | 직접 수정 |
| 결정 추가/변경 | PR로 제안. spec과 코드 변경을 같은 PR에 묶음 |
| 큰 구조 변경 | 새 spec 파일로 작성 후 기존 문서를 `Superseded by` 처리 |

## 언어

본문은 한국어. 식별자·태그·코드 예시는 영어.
다이어그램은 mermaid 또는 ASCII art.

## 현재 상태

- L0 `architecture.md` — Draft
- L1 이하 — 미작성
