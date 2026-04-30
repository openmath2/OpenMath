import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

import { runGeneratorAgent } from "../agents/generator.js";
import { runVerifierAgent } from "../agents/verifier.js";

export const agentRoutes = new Hono();

const generateRequestSchema = z.object({
  schoolLevel: z.enum(["elementary", "middle", "high"]),
  grade: z.number().min(1).max(12),
  topic: z.string().describe("단원명 또는 성취기준코드"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  problemType: z.enum(["objective", "subjective", "essay"]).optional(),
  count: z.number().min(1).max(10).default(1),
  referenceProblemId: z.string().optional(),
});

const verifyRequestSchema = z.object({
  problem: z.string(),
  solution: z.string(),
  answer: z.string(),
});

agentRoutes.post(
  "/generate",
  zValidator("json", generateRequestSchema),
  async (c) => {
    const input = c.req.valid("json");

    try {
      const result = await runGeneratorAgent(input);
      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

agentRoutes.post(
  "/verify",
  zValidator("json", verifyRequestSchema),
  async (c) => {
    const input = c.req.valid("json");

    try {
      const result = await runVerifierAgent(input);
      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);
