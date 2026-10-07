import { describe, expect, it } from "vitest";
import { auc, computeStats, diskCachePath, formatSet, fractionAtOrAbove, splitOf } from "./common";

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
