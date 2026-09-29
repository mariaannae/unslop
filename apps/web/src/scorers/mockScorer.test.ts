import { describe, expect, it } from "vitest";
import { mockScore, mockScorer } from "./mockScorer";
import { noneReferee } from "../referees/none";
import { ctx } from "../test/fakes";

describe("mock scorer", () => {
  it("scores plain prose as 0 with no tells", () => {
    expect(mockScore("My starter smells like beer and I still don't trust it.")).toEqual({
      score: 0,
      tells: [],
    });
  });

  it("adds two points per marker and reports each as a tell", () => {
    const { score, tells } = mockScore("It's not just bread—it's a testament.");
    expect(score).toBe(6);
    expect(tells).toEqual([
      { label: "em-dash", quote: "—" },
      { label: "not-x-but-y", quote: "It's not just" },
      { label: "stock-word", quote: "testament" },
    ]);
  });

  it("caps at 10", () => {
    expect(mockScore("delve tapestry testament pivotal robust crucial realm").score).toBe(10);
  });

  it("is deterministic", async () => {
    const c = ctx({ current: "In today's fast-paced world, experts agree." });
    expect(await mockScorer.score(c)).toEqual(await mockScorer.score(c));
  });
});

describe("none referee", () => {
  it("always approves", async () => {
    expect(await noneReferee.verify(ctx(), { score: 0 })).toEqual({ approved: true, reasons: [] });
  });
});
