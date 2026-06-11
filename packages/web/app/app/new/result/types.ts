export type ResultStatus = "pass" | "warn" | "fail";

export type ResultProblem = {
  id: string;
  number: number;
  isomorphism: "structural" | "conceptual";
  status: ResultStatus;
  questionLatex: string;
  answerLatex: string;
  solutionLatex: string;
  failReason: string | null;
  generationModel?: string;
  refinedBy?: string[];
  gates?: Array<{ step: string; status: string }>;
};
