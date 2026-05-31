import { z } from "zod";

export const CritiqueSchema = z.object({
  passes: z.boolean(),
  hints: z.array(z.string()),
});

export type Critique = z.infer<typeof CritiqueSchema>;
