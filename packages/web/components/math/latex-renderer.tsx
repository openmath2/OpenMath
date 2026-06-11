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

/* ───── LatexAuto — 구분자 없는 산문+수식 자동 분할 ─────
 * 에이전트가 보내는 문항 본문은 한글 산문 사이에 구분자 없는 수식
 * 조각("x^{2} - 3 x = 10", "\sqrt{7}")이 섞인 형태다. 전체를 KaTeX
 * math mode 로 넘기면 한글 공백이 전부 사라지므로, ASCII 단어 묶음
 * 중 수식 신호(\명령, ^{, _{, =, 피연산자 사이 연산자)가 있는 구간만
 * 수식으로 렌더하고 나머지는 일반 텍스트로 둔다.
 * `$...$` / `\(...\)` 구분자가 있으면 splitDelimited 에 위임.
 */

const MATH_WORD = /^[A-Za-z0-9\\^_{}+\-*/=<>().,:%|']+$/;
const MATH_SIGNAL = /\\[a-zA-Z]+|[\^_]\{|=|[0-9A-Za-z)] ?[+\-*/] ?[0-9A-Za-z(]/;
const TRAILING_PUNCT = /[.,]+$/;

export function segmentAuto(source: string): Segment[] {
  if (/\$|\\\(|\\\[/.test(source)) return splitDelimited(source);
  const out: Segment[] = [];
  let text = "";
  const flushText = (): void => {
    if (text.length > 0) {
      out.push({ kind: "text", value: text });
      text = "";
    }
  };
  const tokens = source.split(/(\s+)/);
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i] ?? "";
    if (token.length === 0 || !MATH_WORD.test(token)) {
      text += token;
      i += 1;
      continue;
    }
    // 한 칸 공백으로 이어진 수식 후보 단어들을 하나의 구간으로 묶는다
    let end = i;
    const words = [token];
    while (
      end + 2 < tokens.length &&
      tokens[end + 1] === " " &&
      MATH_WORD.test(tokens[end + 2] ?? "")
    ) {
      words.push(tokens[end + 2] ?? "");
      end += 2;
    }
    const group = words.join(" ");
    const tail = group.match(TRAILING_PUNCT)?.[0] ?? "";
    const body = tail.length > 0 ? group.slice(0, -tail.length) : group;
    if (body.length > 0 && MATH_SIGNAL.test(body)) {
      flushText();
      out.push({ kind: "inline", latex: body });
      text += tail;
    } else {
      text += group;
    }
    i = end + 1;
  }
  flushText();
  return out;
}

type LatexAutoProps = {
  source: string;
};

export function LatexAuto({ source }: LatexAutoProps) {
  const segments = segmentAuto(source);
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
