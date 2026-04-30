import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

describe("health route", () => {
  const app = createApp();

  it("returns ok status", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.services.agent).toBe("up");
    expect(body.timestamp).toBeTypeOf("string");
  });
});

describe("root route", () => {
  const app = createApp();

  it("returns API metadata", async () => {
    const response = await app.request("/");

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.name).toBe("OpenMath Agent API");
    expect(body.endpoints).toBeDefined();
    expect(body.endpoints.generate).toBe("/api/agent/generate");
    expect(body.endpoints.verify).toBe("/api/agent/verify");
  });
});
