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
import { formatLatex } from "../tools/latex-formatter.js";
import { withTimeout } from "../policies/timeout-policy.js";

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
  if (!candidate.question_text.includes("=")) return candidate;
  const solved = await mathEngine.solve({ equation: candidate.question_text });
  if (solved.solutions.length === 0) return candidate;
  return {
    ...candidate,
    expected_answer: solved.solutions.join(", "),
  };
}
