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

interface ObjectiveFailure {
  readonly code: string;
  readonly message: string;
}

interface TechniqueEvidence {
  readonly required_techniques: string[];
  readonly related_techniques: string[];
  readonly techniques_used: string[];
  readonly missing_required_techniques: string[];
  readonly overlapping_techniques: string[];
}

interface DeterministicEvaluation {
  readonly failures: ObjectiveFailure[];
  readonly techniqueEvidence: TechniqueEvidence;
}

interface NuanceLoadResult {
  readonly nuance: ObjectiveMappingNuance | null;
  readonly skippedReason?: string;
}

export async function mapObjective(
  deps: ObjectiveMappingDeps,
  input: ObjectiveMappingInput,
): Promise<ObjectiveMappingOutput> {
  const started = Date.now();
  const deterministic = evaluateDeterministically(input);
  const nuanceResult = await loadNuance(deps, input);
  const failures = deterministic.failures;
  return {
    data: nuanceResult.nuance,
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
        ...deterministic.techniqueEvidence,
        llm_nuance: nuanceResult.nuance,
        ...(nuanceResult.skippedReason === undefined
          ? {}
          : { nuance_skipped_reason: nuanceResult.skippedReason }),
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

function evaluateDeterministically(input: ObjectiveMappingInput): DeterministicEvaluation {
  const failures: ObjectiveFailure[] = [];
  const { request, strategy, refs, candidate } = input;
  const requestTopicCode = getGenerateRequestTopicCode(request);
  const expectedKind = generationKindForTopic(requestTopicCode);
  const techniqueCheck = compareTechniqueSets(input);

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

  failures.push(...techniqueCheck.failures);

  return {
    failures,
    techniqueEvidence: techniqueCheck.evidence,
  };
}

function compareTechniqueSets(input: ObjectiveMappingInput): {
  readonly failures: ObjectiveFailure[];
  readonly evidence: TechniqueEvidence;
} {
  const required = normalizedTechniqueSet(input.intent.required_techniques);
  const related = normalizedTechniqueSet([
    ...input.intent.required_techniques,
    ...(input.strategy?.techniques.required_at_least_one_of ?? []),
  ]);
  const used = normalizedTechniqueSet(input.candidate.techniques_used ?? []);
  const usedSet = new Set(used);
  const missingRequired = required.filter((technique) => !usedSet.has(technique));
  const overlapping = related.filter((technique) => usedSet.has(technique));
  const failures: ObjectiveFailure[] = [];

  if (input.request.mode === "conceptual") {
    if (related.length > 0 && overlapping.length === 0) {
      failures.push({
        code: "technique_mismatch",
        message: `Candidate techniques ${formatTechniqueList(used)} do not overlap required or related techniques ${formatTechniqueList(related)}`,
      });
    }
  } else if (missingRequired.length > 0) {
    failures.push({
      code: "technique_mismatch",
      message: `Candidate techniques ${formatTechniqueList(used)} do not cover required techniques ${formatTechniqueList(missingRequired)}`,
    });
  }

  return {
    failures,
    evidence: {
      required_techniques: required,
      related_techniques: related,
      techniques_used: used,
      missing_required_techniques: missingRequired,
      overlapping_techniques: overlapping,
    },
  };
}

function normalizedTechniqueSet(values: readonly string[]): string[] {
  const techniques = new Set<string>();
  for (const value of values) {
    const technique = normalizeTechnique(value);
    if (technique.length > 0) techniques.add(technique);
  }
  return [...techniques].sort();
}

function normalizeTechnique(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function formatTechniqueList(techniques: readonly string[]): string {
  return techniques.length === 0 ? "[]" : `[${techniques.join(", ")}]`;
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
): Promise<NuanceLoadResult> {
  const llm = deps.llm;
  const prompts = deps.prompts;
  if (llm === undefined || prompts === undefined) return { nuance: null };
  try {
    const nuance = await withTimeout(async () => {
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
    return { nuance };
  } catch (err) {
    return { nuance: null, skippedReason: errorMessage(err) };
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
