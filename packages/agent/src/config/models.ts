/** Default model assignments per agent role. Each prompt frontmatter (D-8) overrides per-call. */

export const DEFAULT_MODELS = {
  intent: "gpt-5.5(xhigh)",
  generator: "gpt-5.5(xhigh)",
  constraintCritic: "gpt-5.5(xhigh)",
  refiner: "gpt-5.5(xhigh)",
  solver: "gpt-5.5(xhigh)",
  objectiveLlm: "gpt-5.5(xhigh)",
} as const;

export type AgentRole = keyof typeof DEFAULT_MODELS;
