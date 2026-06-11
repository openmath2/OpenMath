/** ExtractorAgent — 첨부 문제(이미지 또는 텍스트)를 읽어 Extraction 으로 변환.
 *
 * 이미지: 비전 모델에 image 파트로 첨부. 텍스트: 프롬프트에 본문을 덧붙여 정규화.
 * 출력 스키마는 ExtractionSchema 그대로 (메타데이터 조립 없음).
 */

import { generateObject, type LanguageModel } from "ai";

import { ExtractionSchema, type Extraction } from "../schemas/index.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export interface ExtractorImageInput {
  kind: "image";
  bytes: Uint8Array;
  mediaType: string;
}

export interface ExtractorTextInput {
  kind: "text";
  text: string;
}

export type ExtractorInput = (ExtractorImageInput | ExtractorTextInput) & {
  signal?: AbortSignal;
};

export interface ExtractorAgent {
  extract(input: ExtractorInput): Promise<Extraction>;
}

export interface ExtractorAgentDeps {
  model: LanguageModel;
  modelId: string;
  promptId: string;
  prompts: PromptLoader;
}

export function createExtractorAgent(deps: ExtractorAgentDeps): ExtractorAgent {
  return {
    async extract(input) {
      const prompt = await deps.prompts.load(deps.promptId);
      const instructions = prompt.render({});
      const temperature = prompt.metadata.temperature;

      if (input.kind === "image") {
        const { object } = await generateObject({
          model: deps.model,
          schema: ExtractionSchema,
          mode: "json",
          temperature,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: instructions },
                { type: "image", image: input.bytes, mimeType: input.mediaType },
              ],
            },
          ],
          abortSignal: input.signal,
        });
        return object;
      }

      const { object } = await generateObject({
        model: deps.model,
        schema: ExtractionSchema,
        mode: "json",
        temperature,
        prompt: `${instructions}\n\n# 입력 문제 (텍스트)\n\n${input.text}`,
        abortSignal: input.signal,
      });
      return object;
    },
  };
}
