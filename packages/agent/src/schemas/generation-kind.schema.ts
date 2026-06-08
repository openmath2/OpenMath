import { z } from "zod";

export const GenerationKindSchema = z.enum([
  "equation",
  "inequality",
  "system",
  "expression",
  "function",
  "geometry",
  "probability",
  "statistics",
]);

export type GenerationKind = z.infer<typeof GenerationKindSchema>;

const TOPIC_KIND_BY_CODE: Readonly<Record<string, GenerationKind>> = {
  "9수01-01": "expression",
  "9수01-02": "expression",
  "9수01-03": "expression",
  "9수01-04": "expression",
  "9수01-05": "expression",
  "9수01-06": "expression",
  "9수02-01": "expression",
  "9수02-02": "expression",
  "9수02-03": "equation",
  "9수02-04": "equation",
  "9수02-05": "expression",
  "9수02-06": "inequality",
  "9수02-07": "system",
  "9수02-08": "expression",
  "9수02-09": "equation",
  "9수02-10": "equation",
  "9수03-01": "function",
  "9수03-02": "function",
  "9수03-03": "function",
  "9수03-04": "function",
  "9수04-01": "geometry",
  "9수04-02": "geometry",
  "9수04-03": "geometry",
  "9수04-04": "geometry",
  "9수04-05": "geometry",
  "9수04-06": "geometry",
  "9수04-07": "geometry",
  "9수05-01": "statistics",
  "9수05-02": "probability",
  "9수05-03": "statistics",
};

export function generationKindForTopic(topicCode: string): GenerationKind {
  return TOPIC_KIND_BY_CODE[topicCode] ?? "expression";
}
