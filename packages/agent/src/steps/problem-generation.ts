/** Step 3: Problem generation. D-5 GenerationSpecialist team — Generator + ConstraintCritic + Refiner.
 *  This is the only step with internal multi-agent collaboration. */

import type {
  ConstraintCriticAgent,
  GeneratorAgent,
  RefinerAgent,
} from "../agents/index.js";
import type {
  GenerateRequest,
  GeneratedProblem,
  Intent,
  RagResult,
  Strategy,
} from "../schemas/index.js";

export interface ProblemGenerationDeps {
  generator: GeneratorAgent;
  critic: ConstraintCriticAgent;
  refiner: RefinerAgent;
  maxCriticRounds?: number;
}

export interface ProblemGenerationInput {
  request: GenerateRequest;
  intent: Intent;
  refs: RagResult[];
  strategy: Strategy | null;
  attempt: number;
}

export interface ProblemGenerationOutput {
  candidate: GeneratedProblem;
  refined_by: string[];
}

export async function generateProblem(
  deps: ProblemGenerationDeps,
  input: ProblemGenerationInput,
): Promise<ProblemGenerationOutput> {
  let candidate = withSourceRefs(
    await deps.generator.generate({
      request: input.request,
      intent: input.intent,
      refs: input.refs,
      strategy: input.strategy,
      attempt: input.attempt,
    }),
    input.refs,
  );
  const refinedBy: string[] = [];

  for (let round = 0; round < (deps.maxCriticRounds ?? 1); round += 1) {
    const critique = await deps.critic.critique({
      candidate,
      intent: input.intent,
      strategy: input.strategy,
    });

    if (critique.passes) {
      return { candidate, refined_by: refinedBy };
    }

    candidate = withSourceRefs(
      await deps.refiner.refine({
        prior: candidate,
        intent: input.intent,
        hints: critique.hints,
      }),
      input.refs,
    );
    refinedBy.push("refiner");
  }

  return { candidate, refined_by: refinedBy };
}

function withSourceRefs(
  candidate: GeneratedProblem,
  refs: RagResult[],
): GeneratedProblem {
  const sourceRefs = new Set([
    ...candidate.source_refs,
    ...refs.map((ref) => ref.item_id),
  ]);

  return {
    ...candidate,
    source_refs: [...sourceRefs],
  };
}
