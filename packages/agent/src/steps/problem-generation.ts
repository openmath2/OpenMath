/** Step 3: Problem generation. D-5 GenerationSpecialist team — Generator + ConstraintCritic + Refiner.
 *  This is the only step with internal multi-agent collaboration. */

import type {
  ConstraintCriticAgent,
  GeneratorAgent,
  RefinerAgent,
} from "../agents/index.js";
import type {
  GateResult,
  GenerateRequest,
  GeneratedProblem,
  Intent,
  RagResult,
  Strategy,
} from "../schemas/index.js";
import type { MathEngineClient } from "../tools/math-engine-client.js";
import { extractEquationText } from "../tools/equation-extractor.js";
import { formatLatex } from "../tools/latex-formatter.js";
import { withTimeout } from "../policies/timeout-policy.js";
import {
  deterministicGuardReplacement,
  deterministicTopicGuardHints,
} from "./problem-generation-guards.js";
import { deterministicInitialCandidate } from "./problem-generation-deterministic.js";

export interface ProblemGenerationDeps {
  generator: GeneratorAgent;
  critic: ConstraintCriticAgent;
  refiner: RefinerAgent;
  mathEngine: MathEngineClient;
  perStepTimeoutMs?: number;
  maxCriticRounds?: number;
}

export interface ProblemGenerationInput {
  request: GenerateRequest;
  intent: Intent;
  refs: RagResult[];
  strategy: Strategy | null;
  attempt: number;
  refinementHint?: string;
}

export interface ProblemGenerationOutput {
  data: GeneratedProblem;
  gate: GateResult;
  refined_by: string[];
}

export async function generateProblem(
  deps: ProblemGenerationDeps,
  input: ProblemGenerationInput,
): Promise<ProblemGenerationOutput> {
  const started = Date.now();
  const refinedBy: string[] = [];
  try {
    const candidate = await withTimeout(async () => {
      const initial = input.refs.length > 0 ? deterministicInitialCandidate(input) : null;
      if (initial !== null) {
        refinedBy.push("deterministic-topic-generator");
        return initial;
      }
      let current = await deps.generator.generate({
        request: input.request,
        intent: input.intent,
        refs: input.refs,
        strategy: input.strategy,
        attempt: input.attempt,
        refinementHint: input.refinementHint,
      });
      current = await normalizeExpectedAnswer(deps.mathEngine, current);

      const rounds = deps.maxCriticRounds ?? 2;
      for (let round = 0; round < rounds; round += 1) {
        const guardHints = deterministicTopicGuardHints(input.request, current);
        if (guardHints.length > 0) {
          refinedBy.push("deterministic-topic-guard");
          const replacement = deterministicGuardReplacement(input.request, current);
          if (replacement !== null) {
            current = replacement;
            continue;
          }
          current = await deps.refiner.refine({
            prior: current,
            request: input.request,
            intent: input.intent,
            refs: input.refs,
            strategy: input.strategy,
            attempt: input.attempt,
            hints: guardHints,
          });
          current = await normalizeExpectedAnswer(deps.mathEngine, current);
          refinedBy.push("refiner");
          continue;
        }

        const critique = await deps.critic.critique({
          candidate: current,
          intent: input.intent,
          strategy: input.strategy,
        });
        refinedBy.push("constraint-critic");
        if (critique.passes || critique.hints.length === 0) return current;
        current = await deps.refiner.refine({
          prior: current,
          request: input.request,
          intent: input.intent,
          refs: input.refs,
          strategy: input.strategy,
          attempt: input.attempt,
          hints: critique.hints,
        });
        current = await normalizeExpectedAnswer(deps.mathEngine, current);
        refinedBy.push("refiner");
      }
      return current;
    }, { ms: deps.perStepTimeoutMs ?? 30_000, label: "generate" });

    return {
      data: {
        ...formatCandidateLatex(candidate),
        generation_metadata: {
          ...candidate.generation_metadata,
          refined_by: refinedBy,
        },
      },
      gate: {
        step: "generate",
        status: "passed",
        duration_ms: Date.now() - started,
        evidence: {
          candidate_id: candidate.candidate_id,
          model: candidate.generation_metadata.model,
          refined_by: refinedBy,
        },
      },
      refined_by: refinedBy,
    };
  } catch (err) {
    return {
      data: await Promise.reject(err),
      gate: {
        step: "generate",
        status: "failed",
        duration_ms: Date.now() - started,
        failure_detail: {
          code: "generation_failed",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      refined_by: refinedBy,
    };
  }
}

function formatCandidateLatex(candidate: GeneratedProblem): GeneratedProblem {
  return {
    ...candidate,
    question_text: formatLatex(candidate.question_text),
    expected_answer: formatLatex(candidate.expected_answer),
  };
}

async function normalizeExpectedAnswer(
  mathEngine: MathEngineClient,
  candidate: GeneratedProblem,
): Promise<GeneratedProblem> {
  if (candidate.generation_kind !== "equation") return candidate;
  if (hasChoiceMarkers(candidate.question_text)) return candidate;
  const equation = extractEquationText(candidate.question_text);
  if (equation === null) return candidate;
  const solved = await solveForNormalization(mathEngine, equation);
  if (solved === null) return candidate;
  if (solved.solutions.length === 0) return candidate;
  return {
    ...candidate,
    expected_answer: solved.solutions.join(", "),
  };
}

function hasChoiceMarkers(text: string): boolean {
  return /[①②③④⑤⑥⑦⑧⑨]|\([1-9]\)|[1-9][).]/u.test(text);
}

async function solveForNormalization(
  mathEngine: MathEngineClient,
  equation: string,
): Promise<{ readonly solutions: readonly string[] } | null> {
  try {
    return await mathEngine.solve({ equation });
  } catch {
    return null;
  }
}
