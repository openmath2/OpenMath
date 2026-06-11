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

        <article className="job-entry-card">
          <h2>이 문제처럼</h2>
          <p className="desc">
            가지고 있는 문제를 붙여넣거나 사진으로 올리면, 학년 · 단원을
            자동으로 인식하고 같은 유형의 문제를 만듭니다.
          </p>
          <ul>
            <li>텍스트 · 사진 입력</li>
            <li>학년 · 단원 자동 인식</li>
            <li>같은 평가 차원 보존</li>
            <li>학년 외 기법 자동 차단</li>
          </ul>
          <div className="cta-row">
            <Link href="/app/new/attach" className="btn btn-secondary">
              <span>시작하기</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}
