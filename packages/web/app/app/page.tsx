import Link from "next/link";

export default function WorkspacePage() {
  return (
    <>
      <section className="container-app workspace-header" aria-labelledby="workspace-title">
        <span className="eyebrow-mono">
          <span aria-hidden="true">◆</span>
          워크스페이스
        </span>
        <h1 id="workspace-title">새 작업 시작</h1>
        <p className="lede">
          학년 → 단원 → 의도 → 검증 → PDF. 한 번에 3 ~ 10 문항, 5 ~ 30 초 출제.
        </p>
      </section>

      <section className="container-app entry-grid" aria-label="새 작업 시작">
        <article className="job-entry-card">
          <h2>새 문제 만들기</h2>
          <p className="desc">
            학년 · 단원 · 평가 차원을 골라 동형 문제를 만듭니다. 검증
            6 단계가 실시간으로 노출됩니다.
          </p>
          <ul>
            <li>5 ~ 30 초 출제</li>
            <li>한 번에 3 ~ 10 문항</li>
            <li>SymPy 산술 검증 + 독립 재풀이</li>
            <li>A4 PDF 다운로드</li>
          </ul>
          <div className="cta-row">
            <Link href="/app/new/grade" className="btn btn-primary">
              <span>시작하기</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>

        <article className="job-entry-card" aria-disabled="true">
          <h2>
            이 문제처럼
            <span className="hint-pill" aria-hidden="true">
              준비 중
            </span>
          </h2>
          <p className="desc">
            기존 문제 이미지를 업로드하면 동형을 추출합니다. 캡스톤
            데모 단계에서는 비활성화되어 있습니다.
          </p>
          <ul>
            <li>OCR 이미지 입력</li>
            <li>LaTeX 자동 추출</li>
            <li>같은 평가 차원 보존</li>
            <li>학년 외 기법 자동 차단</li>
          </ul>
          <div className="cta-row">
            <button
              type="button"
              className="btn btn-secondary"
              disabled
              aria-describedby="ocr-disabled-reason"
            >
              <span>준비 중</span>
            </button>
            <span id="ocr-disabled-reason" className="sr-only">
              OCR 입력은 캡스톤 데모 단계에서 비활성화되어 있습니다.
              v2 에서 도입됩니다.
            </span>
          </div>
        </article>
      </section>
    </>
  );
}
