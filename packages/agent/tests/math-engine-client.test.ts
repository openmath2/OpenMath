import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createMathEngineClient } from "../src/tools/math-engine-client.js";

const SolveBodySchema = z.object({
  equation: z.string(),
});

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }),
    ),
  );
});

describe("math-engine client request boundary", () => {
  it("converts LaTeX exponent braces before sending solve requests", async () => {
    const receivedBodies: string[] = [];
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      receivedBodies.push(await readRequestBody(req));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ solutions: ["2", "3"] }));
    });
    servers.push(server);
    await listen(server);

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("test server address must be a TCP address");
    }
    const client = createMathEngineClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
    });

    await client.solve({ equation: "x^{2} - 5x + 6 = 0" });

    expect(receivedBodies).toHaveLength(1);
    const body = SolveBodySchema.parse(JSON.parse(receivedBodies[0] ?? ""));
    expect(body.equation).toBe("x**(2) - 5*x + 6 = 0");
  });

  it("inserts explicit multiplication for adjacent factors before solving", async () => {
    const receivedBodies: string[] = [];
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      receivedBodies.push(await readRequestBody(req));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ solutions: ["-6", "4"] }));
    });
    servers.push(server);
    await listen(server);

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("test server address must be a TCP address");
    }
    const client = createMathEngineClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
    });

    await client.solve({ equation: "(x - 2)(x + 7) = 3 x + 10" });

    const body = SolveBodySchema.parse(JSON.parse(receivedBodies[0] ?? ""));
    expect(body.equation).toBe("(x - 2)*(x + 7) = 3*x + 10");
  });
});

function listen(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.once("error", reject);
  });
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}
