import { describe, expect, it } from "vitest";
import {
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
