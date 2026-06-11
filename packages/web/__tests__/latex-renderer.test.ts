import { describe, expect, it } from "vitest";
import {
  segmentAuto,
  splitDelimited,
  type Segment,
} from "../components/math/latex-renderer";

/*
 * splitDelimited — char-by-char scanner.
 *
 * Dispatch order: \$ (escape) → $$ → $ → \[ → \( → text.
 * Unmatched openers mirror behavior of unmatched `$`: dump the rest into the
 * trailing text buffer (one merged text segment).
 *
 * Baseline probed against the current implementation (cases 5, 11):
 *   - splitDelimited("")     === []
 *   - splitDelimited("a $b") === [{ kind: "text", value: "a $b" }]
 *
 * The new `\[` / `\(` branches must mirror that exact shape on unmatched
 * close — see case 11.
 */

describe("splitDelimited", () => {
  it("case 1: $x$ → one inline 'x'", () => {
    const expected: Segment[] = [{ kind: "inline", latex: "x" }];
    expect(splitDelimited("$x$")).toEqual(expected);
  });

  it("case 2: $$x$$ → one block 'x'", () => {
    const expected: Segment[] = [{ kind: "block", latex: "x" }];
    expect(splitDelimited("$$x$$")).toEqual(expected);
  });

  it("case 3: \\$5 → text '$5' (escape preserved)", () => {
    const expected: Segment[] = [{ kind: "text", value: "$5" }];
    expect(splitDelimited("\\$5")).toEqual(expected);
  });

  it("case 4: foo → text 'foo'", () => {
    const expected: Segment[] = [{ kind: "text", value: "foo" }];
    expect(splitDelimited("foo")).toEqual(expected);
  });

  it("case 5: empty string → [] (baseline behavior)", () => {
    const expected: Segment[] = [];
    expect(splitDelimited("")).toEqual(expected);
  });

  it("case 6: \\[ x = 1 \\] → one block ' x = 1 '", () => {
    const expected: Segment[] = [{ kind: "block", latex: " x = 1 " }];
    expect(splitDelimited("\\[ x = 1 \\]")).toEqual(expected);
  });

  it("case 7: \\( x \\) → one inline ' x '", () => {
    const expected: Segment[] = [{ kind: "inline", latex: " x " }];
    expect(splitDelimited("\\( x \\)")).toEqual(expected);
  });

  it("case 8: array env inside \\[ ... \\] — row-break '\\\\' preserved", () => {
    // Source: \[ \begin{array}{l}a\\b\end{array} \]
    // Expected block latex: " \begin{array}{l}a\\b\end{array} "
    const expected: Segment[] = [
      { kind: "block", latex: " \\begin{array}{l}a\\\\b\\end{array} " },
    ];
    expect(
      splitDelimited("\\[ \\begin{array}{l}a\\\\b\\end{array} \\]"),
    ).toEqual(expected);
  });

  it("case 9: $a$ and \\[ b \\] → inline 'a' + text ' and ' + block ' b '", () => {
    const expected: Segment[] = [
      { kind: "inline", latex: "a" },
      { kind: "text", value: " and " },
      { kind: "block", latex: " b " },
    ];
    expect(splitDelimited("$a$ and \\[ b \\]")).toEqual(expected);
  });

  it("case 10: \\( x \\) and \\[ y \\] → inline ' x ' + text ' and ' + block ' y '", () => {
    const expected: Segment[] = [
      { kind: "inline", latex: " x " },
      { kind: "text", value: " and " },
      { kind: "block", latex: " y " },
    ];
    expect(splitDelimited("\\( x \\) and \\[ y \\]")).toEqual(expected);
  });

  it("case 11: unmatched \\[ → mirror $-unmatched (one merged text segment)", () => {
    // Source: "hello \[ x = 1"
    // Baseline for $-unmatched ("a $b"): [{ kind: "text", value: "a $b" }]
    // → New \[-unmatched must produce ONE text segment containing entire string.
    const expected: Segment[] = [{ kind: "text", value: "hello \\[ x = 1" }];
    expect(splitDelimited("hello \\[ x = 1")).toEqual(expected);
  });

  it("case 12: \\[ \\text{ 두 복소수 } z_1 \\] → one block with Korean \\text intact", () => {
    const expected: Segment[] = [
      { kind: "block", latex: " \\text{ 두 복소수 } z_1 " },
    ];
    expect(splitDelimited("\\[ \\text{ 두 복소수 } z_1 \\]")).toEqual(expected);
  });

  it("case 13: stray \\] → text '\\] stray' (no opener, plain text)", () => {
    const expected: Segment[] = [{ kind: "text", value: "\\] stray" }];
    expect(splitDelimited("\\] stray")).toEqual(expected);
  });

  it("case 14: \\[ a \\\\ b \\] → one block ' a \\\\ b ' (row-break does not close)", () => {
    // Source chars: \[ ' a ' \\ ' b ' \]
    // The \\ at positions 5-6 must not be mistaken for \].
    const expected: Segment[] = [{ kind: "block", latex: " a \\\\ b " }];
    expect(splitDelimited("\\[ a \\\\ b \\]")).toEqual(expected);
  });

  it("case 15: \\[ a \\( b \\) c \\] → outer block consumes inner verbatim", () => {
    const expected: Segment[] = [
      { kind: "block", latex: " a \\( b \\) c " },
    ];
    expect(splitDelimited("\\[ a \\( b \\) c \\]")).toEqual(expected);
  });

  it("case 16: \\$ \\[ x \\] → text '$ ' + block ' x ' (escape + new delim coexist)", () => {
    const expected: Segment[] = [
      { kind: "text", value: "$ " },
      { kind: "block", latex: " x " },
    ];
    expect(splitDelimited("\\$ \\[ x \\]")).toEqual(expected);
  });
});

describe("segmentAuto", () => {
  it("keeps pure Korean prose as a single text segment", () => {
    const source = "어느 축구 동호회에서 12명의 선수를 배치하려고 한다.";
    const expected: Segment[] = [{ kind: "text", value: source }];
    expect(segmentAuto(source)).toEqual(expected);
  });

  it("extracts an undelimited equation run between Korean prose", () => {
    expect(segmentAuto("방정식 x^{2} - 5 x + 6 = 0 의 해를 구하시오.")).toEqual([
      { kind: "text", value: "방정식 " },
      { kind: "inline", latex: "x^{2} - 5 x + 6 = 0" },
      { kind: "text", value: " 의 해를 구하시오." },
    ]);
  });

  it("extracts a LaTeX command run like \\sqrt{7}", () => {
    expect(segmentAuto("한 변의 길이가 \\sqrt{7} 인 정사각형")).toEqual([
      { kind: "text", value: "한 변의 길이가 " },
      { kind: "inline", latex: "\\sqrt{7}" },
      { kind: "text", value: " 인 정사각형" },
    ]);
  });

  it("leaves enumerations like 'A, B, C, D' and bare numbers as text", () => {
    const source = "학생 A, B, C, D 4명을 앞줄에 세운다. 답은 3456 이다.";
    const expected: Segment[] = [{ kind: "text", value: source }];
    expect(segmentAuto(source)).toEqual(expected);
  });

  it("splits trailing sentence punctuation out of a math run", () => {
    expect(segmentAuto("따라서 x = 3, 검산 끝.")).toEqual([
      { kind: "text", value: "따라서 " },
      { kind: "inline", latex: "x = 3" },
      { kind: "text", value: ", 검산 끝." },
    ]);
  });

  it("delegates to splitDelimited when $ delimiters are present", () => {
    expect(segmentAuto("답은 $x = 3$ 이다")).toEqual([
      { kind: "text", value: "답은 " },
      { kind: "inline", latex: "x = 3" },
      { kind: "text", value: " 이다" },
    ]);
  });

  it("preserves newlines in solution traces as text", () => {
    const segments = segmentAuto("1단계: 경우를 나눈다\n2단계: 곱한다");
    expect(segments).toEqual([
      { kind: "text", value: "1단계: 경우를 나눈다\n2단계: 곱한다" },
    ]);
  });
});
