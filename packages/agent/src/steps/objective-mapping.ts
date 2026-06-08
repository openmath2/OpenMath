/** Step 6: Learning objective mapping. Deterministic match on achievement code + evaluation
 *  dimensions (D-5). LLM may suggest nuance, never decides (D-1). */

import type { LanguageModel } from "ai";
import { generateObject } from "ai";

import {
  ObjectiveMappingNuanceSchema,
  generationKindForTopic,
  getGenerateRequestTopicCode,
  strategySupportsConceptual,
  type GateResult,
  type GenerateRequest,
  type GeneratedProblem,
  type Intent,
  type ObjectiveMappingNuance,
  type RagResult,
  type Strategy,
} from "../schemas/index.js";
import { withTimeout } from "../policies/timeout-policy.js";
import type { PromptLoader } from "../tools/prompt-loader.js";

export interface ObjectiveMappingDeps {
  llm?: LanguageModel;
  prompts?: PromptLoader;
  perStepTimeoutMs?: number;
}

export interface ObjectiveMappingInput {
  request: GenerateRequest;
  refs: RagResult[];
  candidate: GeneratedProblem;
  intent: Intent;
  strategy: Strategy | null;
}

export interface ObjectiveMappingOutput {
  data: ObjectiveMappingNuance | null;
  gate: GateResult;
}

export async function mapObjective(
  deps: ObjectiveMappingDeps,
  input: ObjectiveMappingInput,
): Promise<ObjectiveMappingOutput> {
  const started = Date.now();
  const failures = evaluateDeterministically(input);
  const nuance = await loadNuance(deps, input);
  return {
    data: nuance,
    gate: {
      step: "objective_map",
      status: failures.length === 0 ? "passed" : "failed",
      duration_ms: Date.now() - started,
      evidence: {
        refs: input.refs.length,
        mode: input.request.mode,
        source_problem_text: input.request.source_problem_text ?? null,
        strategy_code: input.strategy?.code ?? null,
        difficulty: input.request.difficulty,
        problem_type: input.request.problem_type,
        llm_nuance: nuance,
      },
      failure_detail:
        failures.length === 0
          ? undefined
          : {
              code: failures[0]?.code ?? "objective_map_failed",
              message: failures.map((failure) => failure.message).join("; "),
            },
    },
  };
}

function evaluateDeterministically(input: ObjectiveMappingInput): Array<{ code: string; message: string }> {
  const failures: Array<{ code: string; message: string }> = [];
  const { request, strategy, refs, candidate } = input;
  const requestTopicCode = getGenerateRequestTopicCode(request);
  const expectedKind = generationKindForTopic(requestTopicCode);

  if (
    input.intent.objective_code !== requestTopicCode &&
    !candidateSupportsRequestedTopic(input)
  ) {
    failures.push({
      code: "intent_topic_mismatch",
      message: `Intent ${input.intent.objective_code} does not match request topic ${requestTopicCode}`,
    });
  }

  if (candidate.generation_kind !== expectedKind) {
    failures.push({
      code: "generation_kind_mismatch",
      message: `Candidate kind ${candidate.generation_kind} does not match request topic kind ${expectedKind}`,
    });
  }

  if (strategy !== null) {
    if (strategy.code !== getGenerateRequestTopicCode(request)) {
      failures.push({
        code: "strategy_topic_mismatch",
        message: `Strategy ${strategy.code} does not match request topic ${getGenerateRequestTopicCode(request)}`,
      });
    }
    if (!strategy.difficulty_range.includes(request.difficulty)) {
      failures.push({
        code: "difficulty_unsupported",
        message: `Strategy ${strategy.code} does not support ${request.difficulty} difficulty`,
      });
    }
    if (!strategy.problem_types_supported.includes(request.problem_type)) {
      failures.push({
        code: "problem_type_unsupported",
        message: `Strategy ${strategy.code} does not support ${request.problem_type} problems`,
      });
    }
    if (request.mode === "conceptual" && !strategySupportsConceptual(strategy)) {
      failures.push({
        code: "conceptual_unsupported",
        message: `Strategy ${strategy.code} has no conceptual transforms`,
      });
    }
    if (request.mode !== "conceptual" && strategy.structural_transforms.length === 0) {
      failures.push({
        code: "structural_unsupported",
        message: `Strategy ${strategy.code} has no structural transforms`,
      });
    }
  }

  if (refs.length === 0) {
    failures.push({ code: "no_refs", message: "No reference problems available" });
  }

  const sourceText = request.source_problem_text ?? refs[0]?.problem.question_text;
  if (sourceText !== undefined && sameMathText(candidate.question_text, sourceText)) {
    failures.push({
      code: "not_transformed",
      message: "Generated candidate is identical to the source problem",
    });
  }

  return failures;
}

function candidateSupportsRequestedTopic(input: ObjectiveMappingInput): boolean {
  const target = topicEvidenceText(input);
  const topicName = input.request.topic_name ?? "";
  const sourceText = input.request.source_problem_text ?? "";
  const requestTopicCode = getGenerateRequestTopicCode(input.request);
  return [topicName, sourceText, ...topicAliasQueries(requestTopicCode)].some(
    (query) => query.trim().length > 0 && tokenOverlap(query, target) > 0,
  );
}

function topicEvidenceText(input: ObjectiveMappingInput): string {
  return [
    input.candidate.question_text,
    input.candidate.proposed_solution_trace,
  ].join("\n");
}

function topicAliasQueries(topicCode: string): string[] {
  if (topicCode === "9수01-01") return ["소인수", "소인수분해", "약수", "294"];
  if (topicCode === "9수01-02") return ["정수", "유리수", "대소 관계", "비교", "음수", "양수", "수직선", "가까운"];
  if (topicCode === "9수01-03") return ["유리수", "사칙연산", "식의 값", "계산", "기온", "분수"];
  if (topicCode === "9수01-06") return ["근호", "제곱근", "sqrt", "무리수", "식의 계산"];
  if (topicCode === "9수02-02") return ["일차식", "동류항", "원래의 일차식", "x+5"];
  if (topicCode === "9수02-04") return ["일차방정식", "활용", "공책", "지우개", "4100"];
  if (topicCode === "9수02-05") return ["다항식", "이차식", "식 정리", "식 계산"];
  if (topicCode === "9수02-06") return ["일차부등식", "부등식", "범위", "<", ">"];
  if (topicCode === "9수02-07") return ["연립방정식", "연립", "사과", "배", "x, y"];
  if (topicCode === "9수02-08") return ["다항식", "인수분해", "직사각형", "넓이", "x+3"];
  if (topicCode === "9수02-10") return ["이차방정식", "활용", "x(x+3)", "x*(x+3)", "x*(7-x)", "직사각형", "두 수", "곱", "해"];
  if (topicCode === "9수03-01") return ["함수", "함수식", "좌표", "직선", "y =", "기울기"];
  if (topicCode === "9수03-03") return ["일차함수", "활용", "요금", "대입", "y ="];
  if (topicCode === "9수04-02") return ["삼각형", "이등변삼각형", "밑각", "꼭짓각"];
  if (topicCode === "9수04-04") return ["닮음", "대응", "변", "삼각형"];
  if (topicCode === "9수05-01") return ["자료", "도수", "상대도수", "계급"];
  return [];
}

async function loadNuance(
  deps: ObjectiveMappingDeps,
  input: ObjectiveMappingInput,
): Promise<ObjectiveMappingNuance | null> {
  const llm = deps.llm;
  const prompts = deps.prompts;
  if (llm === undefined || prompts === undefined) return null;
  try {
    return await withTimeout(async () => {
      const prompt = await prompts.load("objective-mapper");
      const rendered = prompt.render({
        candidate: input.candidate,
        intent: input.intent,
        strategy: input.strategy === null ? "" : JSON.stringify(input.strategy, null, 2),
      });
      const { object } = await generateObject({
        model: llm,
        schema: ObjectiveMappingNuanceSchema,
        mode: "json",
        temperature: prompt.metadata.temperature,
        prompt: rendered,
      });
      return object;
    }, { ms: deps.perStepTimeoutMs ?? 30_000, label: "objective_map_llm" });
  } catch {
    return null;
  }
}

function sameMathText(left: string, right: string): boolean {
  return normalizeMathText(left) === normalizeMathText(right);
}

function normalizeMathText(value: string): string {
  return value
    .replace(/²/g, "**2")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function tokenOverlap(query: string, target: string): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;
  const targetTokens = tokenize(target);
  let overlap = 0;
  for (const token of queryTokens) {
    if (targetTokens.some((targetToken) => tokensMatch(token, targetToken))) {
      overlap += 1;
    }
  }
  return overlap / queryTokens.length;
}

function tokenize(text: string): string[] {
  return normalizeTopicText(text)
    .split(/[^0-9a-zA-Z가-힣]+/u)
    .filter((token) => token.length > 0);
}

function normalizeTopicText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokensMatch(queryToken: string, targetToken: string): boolean {
  return (
    queryToken === targetToken ||
    (queryToken.length >= 2 && targetToken.includes(queryToken)) ||
    (targetToken.length >= 2 && queryToken.includes(targetToken))
  );
}
