import "katex/dist/katex.min.css";
import katex from "katex";
import { Fragment } from "react";

/* ─────────────────────────────────────────────────────────────
 * LatexRenderer — DESIGN.md {component.latex-renderer}
 *
 * KaTeX SSR 렌더. Server / Client component 양쪽에서 사용 가능
 * (hook 사용 X, renderToString 만 호출).
 *
 * 두 가지 진입로:
 *   1. <LatexRenderer latex="..." block /> — raw LaTeX (delimiter 없음)
 *   2. <LatexMixed source="...$x$..." /> — `$..$` / `$$..$$` 자동 분할
 *
 * DESIGN.md 정책:
 *   - block 수식은 formula-stage (soft-cloud bg) 안에서만 가운데 정렬
 *   - inline 은 본문 baseline 유지
 *   - 색은 ink, 실패는 fail-deep
 * ──────────────────────────────────────────────────────────── */

type LatexRendererProps = {
  latex: string;
  block?: boolean;
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

function renderLatex(latex: string, block: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode: block,
      throwOnError: true,
      strict: false,
      output: "htmlAndMathml",
      trust: false,
    });
  } catch {
    return `<span class="latex-error">${escapeHtml(latex)}</span>`;
  }
}

export function LatexRenderer({ latex, block = false }: LatexRendererProps) {
  const html = renderLatex(latex, block);
  if (block) {
    return (
      <div
        className="katex-block"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <span
      className="katex-inline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ───── LatexMixed — `$...$` / `$$...$$` 자동 분할 ─────
 * "답은 $x = 3$" 같은 본문을 한 번에 처리.
 * 이스케이프된 `\$` 는 리터럴 달러로 간주.
 */

type LatexMixedProps = {
  source: string;
};

export type Segment =
  | { kind: "text"; value: string }
  | { kind: "inline"; latex: string }
  | { kind: "block"; latex: string };

export function splitDelimited(source: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  let buf = "";

  const flushText = (): void => {
    if (buf.length > 0) {
      out.push({ kind: "text", value: buf });
      buf = "";
    }
  };

  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\" && source[i + 1] === "$") {
      buf += "$";
      i += 2;
      continue;
    }
    if (ch === "$" && source[i + 1] === "$") {
      const end = source.indexOf("$$", i + 2);
      if (end === -1) {
        buf += source.slice(i);
        i = source.length;
        break;
      }
      flushText();
      out.push({ kind: "block", latex: source.slice(i + 2, end) });
      i = end + 2;
      continue;
    }
    if (ch === "$") {
      const end = source.indexOf("$", i + 1);
      if (end === -1) {
        buf += source.slice(i);
        i = source.length;
        break;
      }
      flushText();
      out.push({ kind: "inline", latex: source.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (ch === "\\" && source[i + 1] === "[") {
      const end = source.indexOf("\\]", i + 2);
      if (end === -1) {
        buf += source.slice(i);
        i = source.length;
        break;
      }
      flushText();
      out.push({ kind: "block", latex: source.slice(i + 2, end) });
      i = end + 2;
      continue;
    }
    if (ch === "\\" && source[i + 1] === "(") {
      const end = source.indexOf("\\)", i + 2);
      if (end === -1) {
        buf += source.slice(i);
        i = source.length;
        break;
      }
      flushText();
      out.push({ kind: "inline", latex: source.slice(i + 2, end) });
      i = end + 2;
      continue;
    }
    buf += ch;
    i += 1;
  }
  flushText();
  return out;
}

export function LatexMixed({ source }: LatexMixedProps) {
  const segments = splitDelimited(source);
  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.kind === "text") {
          return <Fragment key={idx}>{seg.value}</Fragment>;
        }
        return (
          <LatexRenderer
            key={idx}
            latex={seg.latex}
            block={seg.kind === "block"}
          />
        );
      })}
    </>
  );
}
