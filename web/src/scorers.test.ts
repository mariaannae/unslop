import { afterEach, describe, expect, it, vi } from "vitest";
import * as scorers from "./scorers";

describe("mock scorer", () => {
  it("scores plain prose as 0 with no tells", () => {
    expect(scorers.mockScore("My starter smells like beer and I still don't trust it.")).toEqual({
      score: 0,
      tells: [],
    });
  });

  it("adds two points per marker and reports each as a tell", () => {
    const { score, tells } = scorers.mockScore("It's not just bread—it's a testament.");
    expect(score).toBe(6);
    expect(tells).toEqual([
      { label: "em-dash", quote: "—" },
      { label: "not-x-but-y", quote: "It's not just" },
      { label: "stock-word", quote: "testament" },
    ]);
  });

  it("caps at 10", () => {
    expect(scorers.mockScore("delve tapestry testament pivotal robust crucial realm").score).toBe(
      10,
    );
  });

  it("is deterministic", async () => {
    const c = { original: "", current: "In today's fast-paced world, experts agree." };
    expect(await scorers.mock.score(c)).toEqual(await scorers.mock.score(c));
  });
});

/** Replaces the global fetch with a spy that answers every request with `body`. */
function stubFetch(status: number, body: unknown) {
  const fetch = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const taskResult = {
  score: 4,
  tells: [{ label: "em-dash", quote: "—" }],
  meaning_preserved: false,
  fluent: true,
  warnings: [],
};

describe("llm-basic scorer", () => {
  it("runs score-v1 with original and current, and exposes the task result as raw", async () => {
    const fetch = stubFetch(200, {
      ok: true,
      taskId: "score-v1",
      version: 1,
      result: taskResult,
      cached: false,
    });

    const result = await scorers.llmBasic.score({ original: "orig", current: "cur" });

    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      taskId: "score-v1",
      payload: { original: "orig", current: "cur" },
    });
    expect(result).toEqual({ score: 4, tells: taskResult.tells, raw: taskResult });
  });

  it("lets task errors propagate so the game can report them", async () => {
    stubFetch(502, {
      ok: false,
      error: { code: "provider_error", message: "upstream down", retryable: true },
    });
    await expect(scorers.llmBasic.score({ original: "a", current: "b" })).rejects.toThrow(
      "upstream down",
    );
  });
});

describe("callTask", () => {
  it("posts {taskId, payload} as JSON to /api/task and returns the result", async () => {
    const fetch = stubFetch(200, {
      ok: true,
      taskId: "score-v1",
      version: 1,
      result: { score: 3 },
      cached: true,
    });

    const result = await scorers.callTask("score-v1", { original: "a", current: "b" });

    expect(result).toEqual({ score: 3 });
    expect(fetch).toHaveBeenCalledWith("/api/task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: "score-v1", payload: { original: "a", current: "b" } }),
    });
  });

  it("throws the server's message for a structured error", async () => {
    stubFetch(429, {
      ok: false,
      error: { code: "rate_limited", message: "slow down", retryable: true },
    });
    await expect(scorers.callTask("score-v1", {})).rejects.toThrow("slow down");
  });

  it("explains network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(scorers.callTask("score-v1", {})).rejects.toThrow(
      "Could not reach the judge (Failed to fetch).",
    );
  });

  it("rejects non-JSON and unexpected bodies", async () => {
    stubFetch(502, "<html>");
    await expect(scorers.callTask("score-v1", {})).rejects.toThrow(
      "Judge returned a non-JSON response (HTTP 502).",
    );

    stubFetch(200, { hello: "world" });
    await expect(scorers.callTask("score-v1", {})).rejects.toThrow(
      "Judge returned an unexpected response (HTTP 200).",
    );
  });

  it("accepts a configured origin with a trailing slash or a trailing /api", () => {
    expect(scorers.normalizeApiOrigin("https://w.example/")).toBe("https://w.example");
    expect(scorers.normalizeApiOrigin("https://w.example/api")).toBe("https://w.example");
    expect(scorers.normalizeApiOrigin("https://w.example/api/")).toBe("https://w.example");
    expect(scorers.normalizeApiOrigin(" ")).toBe("");
    expect(scorers.normalizeApiOrigin(undefined)).toBe("");
  });
});
