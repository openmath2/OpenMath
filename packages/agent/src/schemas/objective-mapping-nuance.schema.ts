/** ObjectiveMappingNuance — optional LLM nuance for Step 6; never decides pass/fail (D-1). */

import { z } from "zod";

export const ObjectiveMappingNuanceSchema = z.object({
  preserved_dimensions: z.array(z.string().min(1)),
  lost_dimensions: z.array(z.string().min(1)),
  drifted_dimensions: z.array(z.string().min(1)),
  rationale: z.string().min(1),
});

export type ObjectiveMappingNuance = z.infer<typeof ObjectiveMappingNuanceSchema>;
