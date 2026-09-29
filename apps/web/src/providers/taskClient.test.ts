import { describe, expect, it, vi } from "vitest";
import { createTaskClient, normalizeApiOrigin, TaskClientError } from "./taskClient";

function fetchReturning(status: number, body: unknown) {
  return vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status }),
  );
}

describe("task client", () => {
  it("posts {taskId, payload} to <origin>/api/task and returns the result", async () => {
    const fetch = fetchReturning(200, {
      ok: true,
      taskId: "score-v1",
      version: 1,
      result: { score: 3 },
      cached: true,
    });
    const client = createTaskClient({ baseUrl: "https://api.test", fetch });

    const out = await client.run("score-v1", { original: "a", current: "b" });

    expect(out).toEqual({ result: { score: 3 }, version: 1, cached: true });
    expect(fetch).toHaveBeenCalledWith("https://api.test/api/task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: "score-v1", payload: { original: "a", current: "b" } }),
    });
  });

  it("maps a structured server error onto TaskClientError with its code and retryable flag", async () => {
    const fetch = fetchReturning(429, {
      ok: false,
      error: { code: "rate_limited", message: "slow down", retryable: true },
    });
    const client = createTaskClient({ baseUrl: "/api", fetch });

    const error = await client.run("score-v1", {}).catch((e) => e);

    expect(error).toBeInstanceOf(TaskClientError);
    expect(error).toMatchObject({ code: "rate_limited", message: "slow down", retryable: true });
  });

  it("reports network failures as retryable", async () => {
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
        throw new TypeError("Failed to fetch");
      },
    );
    const client = createTaskClient({ baseUrl: "/api", fetch });
    await expect(client.run("score-v1", {})).rejects.toMatchObject({
      code: "network",
      retryable: true,
    });
  });

  it("rejects non-JSON and unexpected bodies", async () => {
    const html = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response("<html>", { status: 502 }),
    );
    await expect(
      createTaskClient({ baseUrl: "/api", fetch: html }).run("score-v1", {}),
    ).rejects.toMatchObject({ code: "bad_response" });

    const shapeless = fetchReturning(200, { hello: "world" });
    await expect(
      createTaskClient({ baseUrl: "/api", fetch: shapeless }).run("score-v1", {}),
    ).rejects.toMatchObject({ code: "bad_response" });
  });

  it("accepts an origin with a trailing slash or a trailing /api", () => {
    expect(normalizeApiOrigin("https://w.example/")).toBe("https://w.example");
    expect(normalizeApiOrigin("https://w.example/api")).toBe("https://w.example");
    expect(normalizeApiOrigin("https://w.example/api/")).toBe("https://w.example");
    expect(normalizeApiOrigin(" ")).toBe("");
    expect(normalizeApiOrigin(undefined)).toBe("");
  });

  it("defaults to the same origin when no base URL is configured", async () => {
    const fetch = fetchReturning(200, {
      ok: true,
      taskId: "t",
      version: 1,
      result: 1,
      cached: false,
    });
    await createTaskClient({ fetch }).run("t", {});
    expect(fetch.mock.calls[0]?.[0]).toBe("/api/task");
  });
});
