import { describe, expect, it } from "vitest";
import {
  auc,
  computeStats,
  createPangramClient,
  diskCachePath,
  formatSet,
  fractionAtOrAbove,
  PangramError,
  pangramScore,
  pangramUnits,
  spearman,
  splitOf,
  type PangramResult,
} from "./common";

describe("stats", () => {
  it("computes histogram, mean, and median", () => {
    const stats = computeStats([10, 9, 9, 8, 2]);
    expect(stats.n).toBe(5);
    expect(stats.histogram).toEqual([0, 0, 1, 0, 0, 0, 0, 0, 1, 2, 1]);
    expect(stats.mean).toBeCloseTo(7.6);
    expect(stats.median).toBe(9);
  });

  it("uses the midpoint median for even counts and clamps out-of-range scores", () => {
    expect(computeStats([1, 3]).median).toBe(2);
    expect(computeStats([12, -4]).histogram[10]).toBe(1);
    expect(computeStats([12, -4]).histogram[0]).toBe(1);
    expect(computeStats([]).n).toBe(0);
  });

  it("computes fraction at or above a threshold", () => {
    expect(fractionAtOrAbove([8, 9, 5, 7], 8)).toBe(0.5);
    expect(fractionAtOrAbove([], 8)).toBe(0);
  });

  it("formats a set with PASS/MISS against its target", () => {
    const out = formatSet("AI bank", [10, 9, 8, 7], { threshold: 8, kind: "min", target: 0.95 });
    expect(out).toContain("AI bank (n=4)");
    expect(out).toContain(">=8: 75.0%");
    expect(out).toContain("MISS");
    const human = formatSet("Human corpus", [1, 2, 6], { threshold: 6, kind: "max", target: 0.1 });
    expect(human).toContain(">=6: 33.3%");
    expect(human).toContain("MISS");
    expect(formatSet("x", [1], { threshold: 6, kind: "max", target: 0.1 })).toContain("PASS");
  });
});

describe("separation", () => {
  it("computes AUC as the share of AI/human pairs the AI passage wins, ties counting half", () => {
    expect(auc([3, 4], [1, 2])).toBe(1);
    expect(auc([1, 2], [3, 4])).toBe(0);
    expect(auc([2, 2], [2, 2])).toBe(0.5);
    expect(auc([3, 1], [2])).toBe(0.5);
    expect(auc([], [1])).toBeNaN();
  });

  it("computes Spearman's rank correlation, ties sharing their average rank", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [9, 7, 5, 1])).toBeCloseTo(-1);
    expect(spearman([1, 2, 2, 3], [1, 2, 3, 4])).toBeCloseTo(4.5 / Math.sqrt(22.5));
    expect(spearman([5, 5, 5], [1, 2, 3])).toBeNaN();
    expect(spearman([1], [1])).toBeNaN();
  });

  it("splits deterministically, with about a third held out", () => {
    const keys = Array.from({ length: 3000 }, (_, i) => `key-${i}`);
    expect(keys.map(splitOf)).toEqual(keys.map(splitOf));
    const held = keys.filter((k) => splitOf(k) === "holdout").length / keys.length;
    expect(held).toBeGreaterThan(0.3);
    expect(held).toBeLessThan(0.37);
  });
});

describe("disk cache", () => {
  it("stores a cache key at <root>/<task>@<version>/<hash>.json, as it always has", () => {
    const hash = "ed007e196ecf2622426593b77f3effacbe98ddbe06c741ab4abee4e085df9126";
    expect(diskCachePath("/cache", `task:score-v1@1:${hash}`)).toBe(
      `/cache/score-v1@1/${hash}.json`,
    );
  });
});

describe("Pangram", () => {
  const success: PangramResult = {
    stage: "STAGE_SUCCESS",
    version: "4.0",
    prediction_short: "AI",
    fraction_ai: 1,
    fraction_ai_assisted: 0,
    fraction_human: 0,
    windows: [{ label: "AI-Generated", ai_assistance_score: 0.98, word_count: 117 }],
  };

  /** A fetch that answers with `responses` in order and records each request. */
  function fakeFetch(responses: Array<[status: number, body: unknown]>) {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init! });
      const [status, body] = responses.shift()!;
      return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
    };
    return { fetch: fetch as typeof globalThis.fetch, requests };
  }

  function client(responses: Array<[number, unknown]>) {
    const fake = fakeFetch(responses);
    const sleeps: number[] = [];
    const pangram = createPangramClient("test-key", {
      fetch: fake.fetch,
      sleep: async (ms) => void sleeps.push(ms),
      pollMs: 1000,
      timeoutMs: 3000,
    });
    return { pangram, requests: fake.requests, sleeps };
  }

  it("creates a task with the key, text and model, then polls it until it succeeds", async () => {
    const { pangram, requests } = client([
      [200, { task_id: "t 1" }],
      [200, { task_id: "t 1", stage: "STAGE_PREPROCESSING" }],
      [200, success],
    ]);
    await expect(pangram.detect("Some text.", "pangram-4")).resolves.toEqual(success);
    expect(requests.map((r) => `${r.init.method} ${r.url}`)).toEqual([
      "POST https://text.external-api.pangram.com/task",
      "GET https://text.external-api.pangram.com/task/t%201",
      "GET https://text.external-api.pangram.com/task/t%201",
    ]);
    expect(requests[0]!.init.headers).toMatchObject({ "x-api-key": "test-key" });
    expect(JSON.parse(requests[0]!.init.body as string)).toEqual({
      text: "Some text.",
      model: "pangram-4",
    });
  });

  it("retries a rate-limited request with backoff", async () => {
    const { pangram, sleeps } = client([
      [429, "slow down"],
      [429, "slow down"],
      [200, { task_id: "t" }],
      [200, success],
    ]);
    await expect(pangram.detect("x", "pangram-4")).resolves.toEqual(success);
    expect(sleeps).toEqual([1000, 2000, 1000]);
  });

  it("throws the status of any other error without retrying", async () => {
    const { pangram, requests } = client([[402, "insufficient credits"]]);
    const error = await pangram.detect("x", "pangram-4").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PangramError);
    expect((error as PangramError).status).toBe(402);
    expect((error as PangramError).message).toContain("insufficient credits");
    expect(requests).toHaveLength(1);
  });

  it("throws a failed task's headline, and gives up on a task that never finishes", async () => {
    const failed = client([
      [200, { task_id: "t" }],
      [200, { stage: "STAGE_FAILED", headline: "Input contains no valid text" }],
    ]);
    await expect(failed.pangram.detect("", "pangram-4")).rejects.toThrow(
      "Pangram task failed: Input contains no valid text",
    );
    const stuck = client([
      [200, { task_id: "t" }],
      ...Array.from({ length: 3 }, (): [number, unknown] => [200, { stage: "STAGE_INFERENCE" }]),
    ]);
    await expect(stuck.pangram.detect("x", "pangram-4")).rejects.toThrow("not finished after 3s");
  });

  it("lists the models the key may use", async () => {
    const { pangram, requests } = client([[200, { models: ["default", "pangram-4"] }]]);
    await expect(pangram.models()).resolves.toEqual(["default", "pangram-4"]);
    expect(requests[0]!.init.method).toBe("GET");
    expect(requests[0]!.url).toBe("https://text.external-api.pangram.com/models");
  });

  it("averages window scores by word count, and bills per started 100 words", () => {
    expect(pangramScore(success)).toBe(0.98);
    const windows = [
      { label: "AI-Generated", ai_assistance_score: 1, word_count: 300 },
      { label: "Human Written", ai_assistance_score: 0, word_count: 100 },
    ];
    expect(pangramScore({ ...success, windows })).toBe(0.75);
    expect(() => pangramScore({ ...success, windows: [] })).toThrow("no windows");
    expect(pangramUnits("one two three")).toBe(1);
    expect(pangramUnits(Array(117).fill("word").join(" "))).toBe(2);
    expect(pangramUnits(Array(100).fill("word").join(" "))).toBe(1);
  });
});
