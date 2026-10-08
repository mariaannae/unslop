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
  grammatically_correct: true,
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

  it("adds uniform sentence length from 4 sentences, capped at 10, and lists it", async () => {
    const answer = (score: number) =>
      stubFetch(200, {
        ok: true,
        taskId: "score-v1",
        version: 1,
        result: { ...taskResult, score },
        cached: false,
      });
    const uniform = "The dog ran home. ".repeat(4);

    answer(4);
    const result = await scorers.llmBasic.score({ original: uniform, current: uniform });
    expect(result.score).toBe(5);
    expect(result.tells).toEqual([...taskResult.tells, { label: "uniform-sentence-length" }]);
    expect((result.raw as { score: number }).score).toBe(4);

    answer(10);
    expect((await scorers.llmBasic.score({ original: uniform, current: uniform })).score).toBe(10);

    // Three sentences: not measured, so nothing is added.
    const three = "The dog ran home. ".repeat(3);
    answer(4);
    const short = await scorers.llmBasic.score({ original: three, current: three });
    expect(short).toMatchObject({ score: 4, tells: taskResult.tells });
  });

  it("drops Haiku's own sentence-rhythm tells, whether or not the measured tell shows", async () => {
    const label = (l: string) => ({ label: l, quote: "q" });
    const kept = [
      "triadic-rhythm",
      "uniform-polished-tone",
      "repetitive-sentence-openers",
      "polished-balanced-sentences",
      "em-dash",
    ].map(label);
    const dropped = [
      "uniform-sentence-rhythm",
      "polished-uniform-sentences",
      "even-rhythm-sentences",
      "Monotonous sentence length",
      "lack-of-sentence-variety",
      "low-burstiness",
    ].map(label);
    stubFetch(200, {
      ok: true,
      taskId: "score-v1",
      version: 1,
      result: { ...taskResult, tells: [...dropped, ...kept] },
      cached: false,
    });

    const three = "The dog ran home. ".repeat(3);
    const result = await scorers.llmBasic.score({ original: three, current: three });
    expect(result.tells).toEqual(kept);
    // raw still has everything Haiku said.
    expect((result.raw as typeof taskResult).tells).toHaveLength(dropped.length + kept.length);

    const four = "The dog ran home. ".repeat(4);
    expect((await scorers.llmBasic.score({ original: four, current: four })).tells).toEqual([
      ...kept,
      { label: "uniform-sentence-length" },
    ]);
  });

  it("adds tacked-on -ing phrases and lists of three, quoting each", async () => {
    const haikuTells = [
      { label: "triadic-listing", quote: "bells, lights, and locks" },
      { label: "repetitive-creating-participles", quote: "making it ready" },
      { label: "stacked-ing-openers", quote: "Riding" },
      { label: "em-dash", quote: "—" },
    ];
    stubFetch(200, {
      ok: true,
      taskId: "score-v1",
      version: 1,
      result: { ...taskResult, tells: haikuTells },
      cached: false,
    });
    // One -ing phrase (", including" is not one) and one list: 4 + 0.5 + 0.5 × 0.5.
    const text =
      "We fixed the old bike, making it ready for spring, including the chain. " +
      "Then we bought bells, lights, and locks for the trip.";

    const result = await scorers.llmBasic.score({ original: text, current: text });

    expect(result.score).toBe(4.8);
    // Haiku's tells for the same two things are dropped; sentence openers are another tell.
    expect(result.tells).toEqual([
      { label: "stacked-ing-openers", quote: "Riding" },
      { label: "em-dash", quote: "—" },
      { label: "tacked-on-ing-phrase", quote: "making it ready for spring" },
      { label: "list-of-three", quote: "bells, lights, and locks" },
    ]);
  });

  it("quotes a list's last item up to punctuation, or as long as the second item", async () => {
    stubFetch(200, { ok: true, taskId: "score-v1", version: 1, result: taskResult, cached: false });
    const text = "The pothos, snake plant, and peace lily are easy. Buy soil, pots, and trays.";
    const { tells } = await scorers.llmBasic.score({ original: text, current: text });
    expect(tells).toContainEqual({
      label: "list-of-three",
      quote: "pothos, snake plant, and peace lily",
    });
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

describe("jev scorer", () => {
  it("runs score-jev and score-v1 together and copies score-v1's verdicts into raw", async () => {
    const jevResult = { score: 3, composite: 30, tells: [{ label: "Generic filler" }] };
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const { taskId } = JSON.parse(init!.body as string) as { taskId: string };
      const result = taskId === "score-jev" ? jevResult : taskResult;
      return new Response(JSON.stringify({ ok: true, taskId, version: 1, result, cached: false }));
    });
    vi.stubGlobal("fetch", fetch);

    const result = await scorers.jev.score({ original: "orig", current: "cur" });

    expect(fetch).toHaveBeenCalledTimes(2);
    // The score is on the display scale; raw keeps the task's own score of 3.
    expect(result).toEqual({
      score: 5,
      tells: jevResult.tells,
      raw: { ...jevResult, meaning_preserved: false, grammatically_correct: true },
    });
  });
});

describe("scaleJevScore", () => {
  it("leaves 0–2 as they are, so the win line at 2 picks the same texts", () => {
    for (const raw of [0, 0.4, 1.2, 1.9, 2]) expect(scorers.scaleJevScore(raw)).toBe(raw);
    expect(scorers.scaleJevScore(2.1)).toBe(2.3);
  });

  it("stretches the range above 2: 4 shows as 8 and 7 or more as 10", () => {
    expect(scorers.scaleJevScore(3)).toBe(5);
    expect(scorers.scaleJevScore(4)).toBe(8);
    expect(scorers.scaleJevScore(5.5)).toBe(9);
    expect(scorers.scaleJevScore(7)).toBe(10);
    expect(scorers.scaleJevScore(9.4)).toBe(10);
  });

  it("never reorders two scores", () => {
    const raws = Array.from({ length: 101 }, (_, i) => i / 10);
    const shown = raws.map(scorers.scaleJevScore);
    for (let i = 1; i < shown.length; i++) expect(shown[i]).toBeGreaterThanOrEqual(shown[i - 1]!);
  });
});

describe("setTaskTransport", () => {
  afterEach(() => scorers.setTaskTransport(scorers.callTask));

  it("sends the scorers' task calls through the given transport instead of the Worker", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const calls: string[] = [];
    scorers.setTaskTransport(async <Result>(taskId: string) => {
      calls.push(taskId);
      return (taskId === "score-jev" ? { score: 2.4, tells: [] } : taskResult) as Result;
    });

    const result = await scorers.jev.score({ original: "a", current: "b" });

    expect(calls).toEqual(["score-jev", "score-v1"]);
    expect(fetch).not.toHaveBeenCalled();
    expect(result.score).toBe(3.2);
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
