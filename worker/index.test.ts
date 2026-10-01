import { describe, expect, it } from "vitest";
import worker, { type Env } from "./index";

const allowed = ["https://unslop.app", "http://localhost:5173"];

// Health checks and preflights never touch KV, so empty stand-ins are enough.
function envWith(allowedOrigins: string): Env {
  return {
    ALLOWED_ORIGINS: allowedOrigins,
    TASK_CACHE: {} as unknown as KVNamespace,
    RATE_LIMIT: {} as unknown as KVNamespace,
  };
}
const env = envWith(allowed.join(","));

function health(origin?: string) {
  return new Request("https://api.test/api/health", origin ? { headers: { origin } } : {});
}

describe("worker fetch with CORS", () => {
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
    const response = await worker.fetch(health("http://localhost:5173"), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("reads ALLOWED_ORIGINS as a comma-separated list and ignores blanks", async () => {
    const spaced = envWith(" https://unslop.app, ,http://localhost:5173 ");
    for (const origin of allowed) {
      const response = await worker.fetch(health(origin), spaced);
      expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    }
  });

  it("sends no CORS headers for a foreign origin or a request without one", async () => {
    for (const origin of ["https://evil.example", undefined]) {
      const response = await worker.fetch(health(origin), env);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect(response.headers.get("vary")).toBeNull();
    }
  });

  it("leaves the response itself untouched when no CORS headers apply", async () => {
    const response = await worker.fetch(health(), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await response.json()).toEqual({ ok: true });
  });
});
