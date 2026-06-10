export type VerificationStorageKeyParts = {
  grade: 1 | 2 | 3 | null;
  schoolLevel: "middle" | "high";
  topic: string;
  topicName: string;
  mode: "structural" | "conceptual";
  sourceItemId: string;
};

export function verificationStorageKey(
  p: VerificationStorageKeyParts,
): string {
  return [
    "openmath:verification-result",
    p.grade,
    p.schoolLevel,
    p.topic,
    p.topicName,
    p.mode,
    p.sourceItemId,
  ].join("|");
}
