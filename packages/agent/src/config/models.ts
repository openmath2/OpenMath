/** Default model assignments per agent role. Each prompt frontmatter (D-8) overrides per-call. */

export const DEFAULT_MODELS = {
  intent: "gpt-4o-mini",
  generator: "gpt-4o",
  constraintCritic: "gpt-4o-mini",
  refiner: "gpt-4o",
  solver: "gpt-4o",
  objectiveLlm: "gpt-4o-mini",
} as const;

export type AgentRole = keyof typeof DEFAULT_MODELS;
