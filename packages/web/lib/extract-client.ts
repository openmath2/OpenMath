/* ─────────────────────────────────────────────────────────────
 * extract-client — agent `POST /api/extract` 의 fetch 래퍼.
 *
 * 첨부 문제(텍스트 붙여넣기 또는 이미지)를 읽어 들이고 학년·단원을 자동
 * 인식한다. 확인 화면(/app/new/attach)에서 호출.
 *
 * source-problems-client 와 같은 base URL 규칙(NEXT_PUBLIC_AGENT_URL).
 * 실패 시 사용자에게 그대로 보여줄 한국어 메시지를 담아 throw.
 * ──────────────────────────────────────────────────────────── */

export type Extraction = {
  question_text: string;
  choices: string[] | null;
  answer_text: string | null;
  figure_dependent: boolean;
  confidence: number;
};

export type Classification = {
  school_level: "middle" | "high";
  grade: 1 | 2 | 3 | null;
  topic_code: string;
  topic_name: string;
  problem_type: string;
  difficulty: "easy" | "medium" | "hard";
  /** 문제에서 추론한 풀이 종류. 생성 시 토픽 파생값보다 우선(토픽 오분류 보호). */
  generation_kind?: string;
  confidence: number;
  alternatives: { topic_code: string; topic_name: string }[];
};

export type ExtractResult = {
  extraction: Extraction;
  classification: Classification;
  warnings: string[];
};

function getAgentBaseUrl(): string {
  const env =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_AGENT_URL : undefined;
  return (env ?? "http://localhost:31415").replace(/\/$/, "");
}

async function postExtract(init: RequestInit): Promise<ExtractResult> {
  const url = `${getAgentBaseUrl()}/api/extract`;
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error("출제 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!response.ok) {
    let message = "문제를 읽지 못했어요. 다른 사진이나 텍스트로 다시 시도해 주세요.";
    try {
      const body: unknown = await response.json();
      if (
        body !== null &&
        typeof body === "object" &&
        typeof (body as Record<string, unknown>).message === "string"
      ) {
        message = (body as Record<string, string>).message;
      }
    } catch {
      /* JSON 아님 — 기본 메시지 유지 */
    }
    throw new Error(message);
  }
  return (await response.json()) as ExtractResult;
}

export function extractFromText(text: string): Promise<ExtractResult> {
  return postExtract({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export function extractFromImage(file: File): Promise<ExtractResult> {
  const form = new FormData();
  form.set("image", file);
  return postExtract({ method: "POST", body: form });
}
