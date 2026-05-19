import Link from "next/link";
import { BookStage } from "./book-stage";

export function Hero() {
  return (
    <section className="container-landing relative z-[2] flex flex-col items-center gap-4 pb-10 pt-8 text-center">
      <div className="relative z-[3] mx-auto flex max-w-[720px] flex-col items-center">
        <span className="eyebrow">
          <span className="dot" />
          검증된 문제 한 세트
        </span>
        <h1 className="display-hero">
          수학적으로 검증된 문제,
          <br />
          <em>AI가 무한 생성합니다</em>
        </h1>
        <p className="lede">
          OpenMath 하나로 중등 수학 동형문제를 정확하게 출제하세요
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <Link href="#start" className="btn btn-primary">
            <span>무료로 시작하기</span>
            <span>→</span>
          </Link>
          <Link href="#sample" className="btn btn-ghost">
            <span>샘플 문제 보기</span>
          </Link>
        </div>

        <div className="meta-row">
          <span>· 회원가입</span>
          <span>· 중1–중3 전 단원</span>
          <span>· PDF 즉시 다운로드</span>
        </div>
      </div>

      <BookStage />
    </section>
  );
}
