import type { Metadata } from "next";
import Link from "next/link";
import { LatexRenderer } from "@/components/math/latex-renderer";
import { Footer } from "@/components/landing/footer";
import { Nav } from "@/components/landing/nav";

export const metadata: Metadata = {
  title: "샘플 문제 — OpenMath",
  description:
    "OpenMath 가 실제 검증 6 단계를 통과시킨 예시 문항. 직접 출제해 보기 전에 결과물을 확인하세요.",
};

type Sample = {
  topic: string;
  code: string;
  grade: string;
  iso: "structural" | "conceptual";
  questionLatex: string;
  answerLatex: string;
};

const samples: Sample[] = [
  {
    topic: "일차방정식의 풀이",
    code: "9수04-12",
    grade: "중1",
    iso: "structural",
    questionLatex: "3x + 5 = 14",
    answerLatex: "x = 3",
  },
  {
    topic: "이차방정식 — 인수분해 활용",
    code: "9수02-09",
    grade: "중3",
    iso: "conceptual",
    questionLatex: "x^{2} - 5x + 6 = 0",
    answerLatex: "x = 2,\\; 3",
  },
  {
    topic: "삼각비의 정의",
    code: "9수04-05",
    grade: "중3",
    iso: "structural",
    questionLatex: "\\sin 30^{\\circ} + \\cos 60^{\\circ}",
    answerLatex: "1",
  },
];

function isoBadge(
  iso: "structural" | "conceptual",
): { className: "badge-pass" | "badge-concept"; icon: string; text: string } {
  if (iso === "structural") {
    return { className: "badge-pass", icon: "✓", text: "구조 동형" };
  }
  return { className: "badge-concept", icon: "✦", text: "개념 동형" };
}

export default function SamplesPage() {
  return (
    <div className="landing-canvas landing-grid relative min-h-screen">
      <Nav />

      <main className="container-landing samples-section">
        <header className="samples-header">
          <span className="eyebrow">
            <span className="dot" />
            SAMPLES · 검증 통과 예시
          </span>
          <h1 className="samples-title">
            실제로 만들어지는 문제
          </h1>
          <p className="samples-lede">
            아래 3 문항은 OpenMath 가 RAG 검색 → 의도 추출 → 생성 →
            SymPy 산술 검증 → 독립 재풀이 → 학습 목표 매핑의 6 단계를
            통과시킨 예시입니다. 직접 출제하면 학년과 단원을 골라 동일한
            품질의 문항을 만들 수 있습니다.
          </p>
        </header>

        <div className="samples-grid">
          {samples.map((s) => {
            const badge = isoBadge(s.iso);
            return (
              <article key={s.code} className="sample-card">
                <header className="sample-head">
                  <span className="sample-topic">{s.topic}</span>
                  <span className={`badge ${badge.className}`}>
                    <span aria-hidden="true">{badge.icon}</span>
                    <span>{badge.text}</span>
                  </span>
                </header>
                <div
                  className="sample-stage"
                  role="img"
                  aria-label={`${s.topic} 예시 문항`}
                >
                  <LatexRenderer latex={s.questionLatex} block />
                </div>
                <div className="sample-meta">
                  <span className="sample-answer-label">
                    {s.grade} · {s.code}
                  </span>
                  <span className="sample-answer-value">
                    답&nbsp;&nbsp;
                    <LatexRenderer latex={s.answerLatex} />
                  </span>
                </div>
              </article>
            );
          })}
        </div>

        <div className="samples-cta">
          <Link href="/app" className="btn btn-primary">
            <span>직접 출제하기</span>
            <span aria-hidden="true">→</span>
          </Link>
          <span className="samples-cta-note">
            · 무료 · 회원가입 없이 즉시 사용
          </span>
        </div>
      </main>

      <Footer />
    </div>
  );
}
