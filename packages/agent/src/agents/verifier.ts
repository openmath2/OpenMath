import { Agent, run } from "@openai/agents";

import { getDefaultModel } from "../config/llm.js";
import { sympySolve, sympyVerify, sympySimplify } from "../tools/sympy.js";

let verifierAgent: Agent | null = null;

function getVerifierAgent(): Agent {
  if (!verifierAgent) {
    verifierAgent = new Agent({
      name: "MathProblemVerifier",
      model: getDefaultModel(),
      instructions: `당신은 수학 문제의 정확성을 검증하는 전문가입니다.

검증 단계:
1. 풀이의 각 단계가 수학적으로 올바른지 확인
2. 최종 답이 문제 조건을 만족하는지 확인  
3. 답의 유일성 확인 (다른 답이 가능한지)
4. 조건의 모순 여부 확인

모든 계산은 반드시 sympy 도구를 사용하여 검증하세요.
직접 계산하지 말고, sympy_solve, sympy_verify, sympy_simplify 도구를 호출하세요.

검증 결과:
- valid: true/false
- errors: 발견된 오류 목록
- warnings: 잠재적 문제점
- verifiedSteps: 검증된 풀이 단계들`,

      tools: [sympySolve, sympyVerify, sympySimplify],
    });
  }
  return verifierAgent;
}

export interface VerifyInput {
  problem: string;
  solution: string;
  answer: string;
}

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  verifiedSteps: Array<{
    step: string;
    verified: boolean;
    sympyResult?: string;
  }>;
}

export async function runVerifierAgent(
  input: VerifyInput
): Promise<VerificationResult> {
  const prompt = `다음 수학 문제와 풀이를 검증해주세요.

문제:
${input.problem}

풀이:
${input.solution}

정답:
${input.answer}

각 계산 단계를 sympy 도구로 검증하고, 결과를 JSON 형식으로 반환해주세요.`;

  const result = await run(getVerifierAgent(), prompt);

  return parseVerifierOutput(result.finalOutput ?? "");
}

function parseVerifierOutput(output: string): VerificationResult {
  try {
    return JSON.parse(output);
  } catch {
    return {
      valid: false,
      errors: ["Failed to parse verification result"],
      warnings: [],
      verifiedSteps: [],
    };
  }
}
