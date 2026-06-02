"use client";

import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────
 * Book stack — landing hero 시그니처.
 * SCREENS.md L47-49 / MOCKUPS.md L54-65 / DESIGN.md {component.book-cover}.
 *
 * 4권 시리즈 (동형 · 검증 · 수식 · 교육과정) 가 perspective 1800px 안에서
 * rotateX(28°) 로 살짝 뒤로 기울어 책장에 진열된 모습. 표지마다 다른
 * 그라데이션 (blue / green / orange / zinc) 으로 OpenMath 의 4개 가치 축을
 * 시각화. 표지에 마우스를 올리면 좌측 spine 을 축으로 168° 펼쳐지며
 * 안쪽 페이지 (예시 수식) 가 드러난다.
 *
 * 떠다니는 수식 토큰 (∑ⁿₖ₌₁ k² 등) 6개가 책 주변에 흩어져 있고,
 * 스테이지 내부 마우스 위치 (CSS var --mouse-x/y 0 ~ ±0.5) 에 따라
 * 토큰들이 data-depth 차등으로 parallax 이동한다.
 *
 * prefers-reduced-motion: reduce 시 mouse parallax + idle drift + flip
 * 전부 무력화 (CSS 측 @media + JS 측 effect 단축).
 * ──────────────────────────────────────────────────────────── */

type BookKind = "isomorphic" | "verify" | "formula" | "curriculum";

type Book = {
  kind: BookKind;
  series: string;
  titleKo: string;
  titleEn: string;
  glyph: string;
  meta: string;
  innerFormula: string;
  innerCaption: string;
  ariaLabel: string;
};

const BOOKS: readonly Book[] = [
  {
    kind: "isomorphic",
    series: "VOL. 01",
    titleKo: "동형",
    titleEn: "Isomorphism",
    glyph: "≅",
    meta: "structural · conceptual",
    innerFormula: "(x − 2)(x + 5)",
    innerCaption: "same approach · different surface",
    ariaLabel: "동형 — 구조 동형과 개념 동형의 두 모드",
  },
  {
    kind: "verify",
    series: "VOL. 02",
    titleKo: "검증",
    titleEn: "Verification",
    glyph: "✓",
    meta: "SymPy · 6 gates",
    innerFormula: "sympy.solve(eq, x)",
    innerCaption: "deterministic gate",
    ariaLabel: "검증 — SymPy 결정론 6단계 검증",
  },
  {
    kind: "formula",
    series: "VOL. 03",
    titleKo: "수식",
    titleEn: "Symbolic",
    glyph: "∫",
    meta: "LaTeX · KaTeX",
    innerFormula: "∫ x² dx",
    innerCaption: "rendered with KaTeX",
    ariaLabel: "수식 — LaTeX 기반 수식 처리와 출력",
  },
  {
    kind: "curriculum",
    series: "VOL. 04",
    titleKo: "교육과정",
    titleEn: "Curriculum",
    glyph: "敎",
    meta: "2022 개정 · 중1–중3",
    innerFormula: "9수04-12",
    innerCaption: "achievement standards",
    ariaLabel: "교육과정 — 2022 개정 중학 수학 전 단원",
  },
];

type FloatingToken = {
  text: string;
  depth: number;
  top: string;
  left: string;
  variant: "glyph" | "mono";
};

/* 6개 (desktop) — `floating-token:nth-child(n+4)` CSS 가 mobile 에서 3개로 축소 */
const TOKENS: readonly FloatingToken[] = [
  { text: "∑ⁿₖ₌₁ k²", depth: 0.8, top: "10%", left: "6%", variant: "glyph" },
  { text: "√(b² − 4ac)", depth: 0.5, top: "76%", left: "78%", variant: "glyph" },
  { text: "π", depth: 0.7, top: "22%", left: "90%", variant: "glyph" },
  { text: "y = mx + b", depth: 0.4, top: "84%", left: "5%", variant: "glyph" },
  { text: "sympy.simplify(...)", depth: 0.35, top: "45%", left: "2%", variant: "mono" },
  { text: "verified ✓", depth: 0.6, top: "58%", left: "88%", variant: "mono" },
];

export function BookStage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent): void => setReduceMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* 마우스 parallax — stage 내부 위치를 normalize (-0.5..0.5) 해서 CSS var 로 publish.
   * 책 (×12px) + 토큰 (×depth × -40px) 이 동일 var 를 받아 차등 반응.
   * reduced-motion 시 effect 자체를 등록하지 않음.
   */
  useEffect(() => {
    if (reduceMotion) return;
    const node = stageRef.current;
    if (!node) return;
    const handleMove = (e: MouseEvent): void => {
      const rect = node.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      node.style.setProperty("--mouse-x", nx.toFixed(3));
      node.style.setProperty("--mouse-y", ny.toFixed(3));
    };
    const handleLeave = (): void => {
      node.style.setProperty("--mouse-x", "0");
      node.style.setProperty("--mouse-y", "0");
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    node.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      node.removeEventListener("mouseleave", handleLeave);
    };
  }, [reduceMotion]);

  return (
    <div
      ref={stageRef}
      className={"book-stage" + (reduceMotion ? " is-reduced-motion" : "")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="floating-tokens" aria-hidden="true">
        {TOKENS.map((t, i) => (
          <span
            key={t.text}
            className={"floating-token" + (t.variant === "mono" ? " is-mono" : "")}
            style={{
              top: t.top,
              left: t.left,
              ["--depth" as string]: t.depth,
              animationDelay: `${(i * 0.7).toFixed(2)}s`,
            }}
          >
            {t.text}
          </span>
        ))}
      </div>

      <div className="book-stack">
        {BOOKS.map((book, idx) => (
          <article
            key={book.kind}
            className={`book-cover book-cover-${book.kind}`}
            role="img"
            aria-label={book.ariaLabel}
            style={{ animationDelay: `${(idx * 0.35).toFixed(2)}s` }}
          >
            <div className="book-cover-page" aria-hidden="true">
              <span className="book-cover-page-formula">{book.innerFormula}</span>
              <span className="book-cover-page-caption">{book.innerCaption}</span>
            </div>

            <div className="book-cover-front">
              <span className="book-cover-paper" aria-hidden="true" />
              <header className="book-cover-top">
                <span className="book-cover-series">{book.series}</span>
                <span className="book-cover-brand">OpenMath</span>
              </header>
              <div className="book-cover-title">
                <span className="book-cover-title-ko">{book.titleKo}</span>
                <span className="book-cover-title-en">{book.titleEn}</span>
              </div>
              <footer className="book-cover-bottom">
                <span className="book-cover-glyph" aria-hidden="true">
                  {book.glyph}
                </span>
                <span className="book-cover-meta">{book.meta}</span>
              </footer>
            </div>
          </article>
        ))}
      </div>

      <div
        className={"book-stage-hint" + (hovered ? " is-faded" : "")}
        aria-hidden={hovered ? "true" : "false"}
      >
        <span className="book-stage-hint-dot" aria-hidden="true" />
        마우스를 올리면 표지가 펼쳐집니다
      </div>
    </div>
  );
}
