import { describe, expect, it } from "vitest";

import { parseCritiqueJson } from "../src/agents/constraint-critic-agent.js";

describe("parseCritiqueJson", () => {
  it("repairs raw LaTeX backslashes before parsing critique JSON", () => {
    const modelTextWithRawLatexEscapes =
      '{"passes":false,"hints":["수식 예시는 \\sqrt{2} 대신 plain text로 설명하세요.","\\(x-1\\) 표기는 쓰지 마세요."]}';

    const critique = parseCritiqueJson(modelTextWithRawLatexEscapes);

    expect(critique).toEqual({
      passes: false,
      hints: [
        "수식 예시는 \\sqrt{2} 대신 plain text로 설명하세요.",
        "\\(x-1\\) 표기는 쓰지 마세요.",
      ],
    });
  });
});
