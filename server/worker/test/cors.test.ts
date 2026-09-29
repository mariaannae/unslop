import { describe, expect, it } from "vitest";
import { corsHeaders, parseAllowedOrigins, withCors } from "../src/cors";
import worker from "../src/index";
import type { Env } from "../src/env";
import { createMemoryKv } from "./memoryKv";

const allowed = ["https://unslop.app", "http://localhost:5173"];

describe("cors helpers", () => {
  it("parses a comma-separated list and ignores blanks", () => {
    expect(parseAllowedOrigins(" https://unslop.app, ,http://localhost:5173 ")).toEqual(allowed);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });

  it("returns headers only for an allowed origin", () => {
    expect(corsHeaders("https://unslop.app", allowed)["access-control-allow-origin"]).toBe(
      "https://unslop.app",
    );
    expect(corsHeaders("https://evil.example", allowed)).toEqual({});
    expect(corsHeaders(null, allowed)).toEqual({});
  });

  it("withCors leaves a response untouched when there are no headers", () => {
    const response = new Response("x");
    expect(withCors(response, {})).toBe(response);
  });
});

describe("worker fetch with CORS", () => {
  const env: Env = {
    ALLOWED_ORIGINS: allowed.join(","),
    TASK_CACHE: createMemoryKv() as unknown as KVNamespace,
    RATE_LIMIT: createMemoryKv() as unknown as KVNamespace,
  };

  it("answers preflight for an allowed origin with 204 and the CORS headers", async () => {
    const response = await worker.fetch(
      new Request("https://api.test/api/task", {
        method: "OPTIONS",
        headers: { origin: "https://unslop.app" },
      }),
      env,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://unslop.app");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("answers preflight for a foreign origin without CORS headers", async () => {
    const response = await worker.fetch(
      new Request("https://api.test/api/task", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example" },
      }),
      env,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("adds CORS headers to real responses for an allowed origin", async () => {
    const response = await worker.fetch(
      new Request("https://api.test/api/health", { headers: { origin: "http://localhost:5173" } }),
      env,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(await response.json()).toEqual({ ok: true });
  });
});
