/** Critique — D-5 GenerationSpecialist non-mathematical constraint review. */

import { z } from "zod";

export const CritiqueSchema = z.object({
  passes: z.boolean(),
  hints: z.array(z.string().min(1)),
});

export type Critique = z.infer<typeof CritiqueSchema>;
