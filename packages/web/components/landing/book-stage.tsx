"use client";

import { useEffect, useRef } from "react";

type BookSpec = {
  variant: "blue" | "green" | "orange" | "zinc";
  vol: string;
  grade: string;
  titleLead: string;
  titleEm: string;
  glyph: string;
  curriculumCode: string;
};

const books: BookSpec[] = [
  {
    variant: "blue",
    vol: "VOL 01",
    grade: "GRADE 7 · 중학교1",
    titleLead: "수와 ",
    titleEm: "연산",
    glyph: "∀x",
    curriculumCode: "2022 개정 · 7수",
  },
  {
    variant: "green",
    vol: "VOL 02",
    grade: "GRADE 8 · 중학교2",
    titleLead: "일차 ",
    titleEm: "함수",
    glyph: "y=mx+b",
    curriculumCode: "2022 개정 · 8수",
  },
  {
    variant: "orange",
    vol: "VOL 03",
    grade: "GRADE 9 · 중학교3",
    titleLead: "이차 ",
    titleEm: "방정식",
    glyph: "x²+bx+c",
    curriculumCode: "2022 개정 · 9수",
  },
  {
    variant: "zinc",
    vol: "VOL 04",
    grade: "GRADE 9 · 종합",
    titleLead: "도형과 ",
    titleEm: "함수",
    glyph: "a²+b²",
    curriculumCode: "2022 개정 · 종합",
  },
];

const tokens = [
  { content: "∑ⁿₖ₌₁ k²", depth: 0.6, style: { left: "8%", top: "14%" }, mono: false },
  { content: "sympy.simplify(...)", depth: 0.4, style: { left: "12%", top: "74%" }, mono: true },
  { content: "√(b² − 4ac)", depth: 0.8, style: { right: "10%", top: "18%" }, mono: false },
  { content: "verified ✓", depth: 0.5, style: { right: "6%", top: "66%" }, mono: true },
  { content: "π", depth: 0.3, style: { left: "46%", top: "6%" }, mono: false },
  {
    content: "y = mx + b",
    depth: 0.7,
    style: { left: "30%", top: "88%", fontSize: 18 },
    mono: false,
  },
];

const BOOK_THICKNESS = 14;

export function BookStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const bookRefs = useRef<Array<HTMLDivElement | null>>([]);
  const tokenRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const stage = stageRef.current;
    const stack = stackRef.current;
    const hint = hintRef.current;
    if (!stage || !stack || !hint) return;

    const N = books.length;
    const thresholds = books.map((_, i) => 0.58 + (i / N) * 0.32);

    let mx = 0.18;
    let my = 0.5;
    let tx = 0.18;
    let ty = 0.5;
    let inside = false;
    let raf = 0;

    function onMove(e: MouseEvent) {
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width;
      my = (e.clientY - r.top) / r.height;
      inside = mx >= 0 && mx <= 1 && my >= 0 && my <= 1;
      if (hint) hint.style.opacity = inside ? "0" : "1";
    }
    function onLeave() {
      inside = false;
      mx = 0.18;
      my = 0.5;
      if (hint) hint.style.opacity = "1";
    }

    document.addEventListener("mousemove", onMove);
    stage.addEventListener("mouseleave", onLeave);

    function loop() {
      tx += (mx - tx) * 0.08;
      ty += (my - ty) * 0.08;

      const tiltZ = (tx - 0.5) * 6;
      const tiltX = (0.5 - ty) * 4;
      if (stack) {
        stack.style.setProperty("--tilt-y", `${tiltZ}deg`);
        stack.style.setProperty("--tilt-x", `${tiltX}deg`);
      }

      bookRefs.current.forEach((b, i) => {
        if (!b) return;
        const t = thresholds[i];
        let progress: number;
        if (tx <= t - 0.1) progress = 0;
        else if (tx >= t + 0.1) progress = 1;
        else progress = (tx - (t - 0.1)) / 0.2;

        const angle = -progress * 168;
        const lift = Math.sin(progress * Math.PI) * 32;
        const baseZ = (N - 1 - i) * BOOK_THICKNESS;
        b.style.transform = `translateZ(${baseZ + lift}px) rotateY(${angle}deg)`;
        b.style.zIndex = String(progress > 0.5 ? 10 - i : 100 + (N - i));
      });

      tokenRefs.current.forEach((tk, i) => {
        if (!tk) return;
        const d = tokens[i].depth;
        const dx = (tx - 0.5) * -40 * d;
        const dy = (ty - 0.5) * -24 * d;
        tk.style.transform = `translate(${dx}px, ${dy}px)`;
      });

      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    let idle = 0;
    const idleTimer = window.setInterval(() => {
      if (inside) return;
      idle += 0.02;
      mx = 0.18 + Math.sin(idle) * 0.04;
      my = 0.5 + Math.cos(idle * 0.7) * 0.03;
    }, 30);

    return () => {
      document.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
      window.clearInterval(idleTimer);
    };
  }, []);

  return (
    <div ref={stageRef} className="book-stage">
      {tokens.map((tk, i) => (
        <div
          key={i}
          ref={(el) => {
            tokenRefs.current[i] = el;
          }}
          className={`token${tk.mono ? " token-mono" : ""}`}
          style={tk.style as React.CSSProperties}
          data-depth={tk.depth}
        >
          {tk.content}
        </div>
      ))}

      <div ref={stackRef} className="book-stack">
        {books.map((b, i) => (
          <div
            key={i}
            ref={(el) => {
              bookRefs.current[i] = el;
            }}
            className={`book book-${b.variant}`}
            data-i={i}
          >
            <div className="cover cover-front">
              <div className="cover-inner">
                <div className="cover-top">
                  <span className="om">
                    <span className="om-mark">∫</span> OpenMath
                  </span>
                  <span>{b.vol}</span>
                </div>
                <h2 className="cover-title">
                  <span className="grade">{b.grade}</span>
                  {b.titleLead}
                  <em>{b.titleEm}</em>
                </h2>
                <div className="cover-bottom">
                  <div className="cover-glyph">{b.glyph}</div>
                  <div className="cover-meta">
                    <div className="verified">
                      <span className="v-dot" /> SymPy verified
                    </div>
                    <div>{b.curriculumCode}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="cover cover-back" />
          </div>
        ))}
      </div>

      <div ref={hintRef} className="hint">
        <span>마우스를 올리면 표지가 넘어갑니다</span>
        <span className="arrow" />
      </div>
    </div>
  );
}
