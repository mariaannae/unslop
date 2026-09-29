import { describe, expect, it } from "vitest";
import { createPipeline } from "./pipeline";
import { ctx, fakeGuardrail, fakeReferee, fakeScorer } from "../test/fakes";

const win = { scoreAtOrBelow: 2 };

describe("pipeline ordering", () => {
  it("a failing local guardrail stops before the scorer and consumes nothing", async () => {
    const scorer = fakeScorer({ score: 0 });
    const local = fakeGuardrail("local", true, { pass: false, reason: "no" });
    const remote = fakeGuardrail("remote", false);
    const referee = fakeReferee();
    const pipeline = createPipeline({ scorer, guardrails: [local, remote], referee, win });

    const outcome = await pipeline.runCheck(ctx());

    expect(scorer.score).not.toHaveBeenCalled();
    expect(remote.check).not.toHaveBeenCalled();
    expect(referee.verify).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      guardrails: [{ id: "local", result: { pass: false, reason: "no" } }],
      win: false,
      checkConsumed: false,
    });
  });

  it("runs every local guardrail even after one fails, so feedback is complete", async () => {
    const a = fakeGuardrail("a", true, { pass: false, reason: "a" });
    const b = fakeGuardrail("b", true, { pass: false, reason: "b" });
    const pipeline = createPipeline({ scorer: fakeScorer(), guardrails: [a, b], win });

    const outcome = await pipeline.runCheck(ctx());

    expect(outcome.guardrails.map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("runs the scorer when local guardrails pass and marks the check consumed", async () => {
    const scorer = fakeScorer({ score: 7 });
    const pipeline = createPipeline({ scorer, guardrails: [fakeGuardrail("l", true)], win });

    const outcome = await pipeline.runCheck(ctx({ current: "edited" }));

    expect(scorer.score).toHaveBeenCalledWith(ctx({ current: "edited" }));
    expect(outcome.score).toEqual({ score: 7 });
    expect(outcome.checkConsumed).toBe(true);
  });

  it("runs remote guardrails after the scorer and hands them the ScoreResult", async () => {
    const order: string[] = [];
    const scorer = fakeScorer({ score: 1, raw: { meaning_preserved: false } });
    scorer.score.mockImplementation(async () => {
      order.push("scorer");
      return { score: 1, raw: { meaning_preserved: false } };
    });
    const remote = fakeGuardrail("remote", false);
    remote.check.mockImplementation(async () => {
      order.push("remote");
      return { pass: true };
    });
    const pipeline = createPipeline({ scorer, guardrails: [remote], win });

    const outcome = await pipeline.runCheck(ctx());

    expect(order).toEqual(["scorer", "remote"]);
    expect(remote.check).toHaveBeenCalledWith(ctx(), {
      score: 1,
      raw: { meaning_preserved: false },
    });
    expect(outcome.guardrails).toEqual([{ id: "remote", result: { pass: true } }]);
  });

  it("calls local guardrails without a score argument", async () => {
    const local = fakeGuardrail("local", true);
    const pipeline = createPipeline({ scorer: fakeScorer(), guardrails: [local], win });

    await pipeline.runCheck(ctx());

    expect(local.check).toHaveBeenCalledTimes(1);
    expect(local.check.mock.calls[0]).toHaveLength(1);
  });

  it("invokes the referee only for a would-be win", async () => {
    const referee = fakeReferee();
    const pipeline = createPipeline({
      scorer: fakeScorer({ score: 2 }),
      guardrails: [],
      referee,
      win,
    });

    const outcome = await pipeline.runCheck(ctx());

    expect(referee.verify).toHaveBeenCalledWith(ctx(), { score: 2 });
    expect(outcome.referee).toEqual({ approved: true, reasons: [] });
    expect(outcome.win).toBe(true);
  });

  it("skips the referee for a losing score", async () => {
    const referee = fakeReferee();
    const pipeline = createPipeline({
      scorer: fakeScorer({ score: 3 }),
      guardrails: [],
      referee,
      win,
    });

    const outcome = await pipeline.runCheck(ctx());

    expect(referee.verify).not.toHaveBeenCalled();
    expect(outcome.referee).toBeUndefined();
    expect(outcome.win).toBe(false);
  });

  it("skips the referee when a remote guardrail fails", async () => {
    const referee = fakeReferee();
    const remote = fakeGuardrail("remote", false, { pass: false, reason: "meaning changed" });
    const pipeline = createPipeline({
      scorer: fakeScorer({ score: 0 }),
      guardrails: [remote],
      referee,
      win,
    });

    const outcome = await pipeline.runCheck(ctx());

    expect(referee.verify).not.toHaveBeenCalled();
    expect(outcome.win).toBe(false);
    expect(outcome.checkConsumed).toBe(true);
  });

  it("propagates scorer errors instead of swallowing them", async () => {
    const pipeline = createPipeline({
      scorer: fakeScorer(new Error("provider down")),
      guardrails: [],
      win,
    });

    await expect(pipeline.runCheck(ctx())).rejects.toThrow("provider down");
  });
});

describe("win logic", () => {
  it("wins on score at threshold, guardrails passing, no referee", async () => {
    const pipeline = createPipeline({
      scorer: fakeScorer({ score: 2 }),
      guardrails: [fakeGuardrail("l", true), fakeGuardrail("r", false)],
      win,
    });
    const outcome = await pipeline.runCheck(ctx());
    expect(outcome.win).toBe(true);
    expect(outcome.referee).toBeUndefined();
  });

  it("does not win above the threshold", async () => {
    const pipeline = createPipeline({ scorer: fakeScorer({ score: 3 }), guardrails: [], win });
    expect((await pipeline.runCheck(ctx())).win).toBe(false);
  });

  it("does not win when a guardrail fails, even at score 0", async () => {
    const pipeline = createPipeline({
      scorer: fakeScorer({ score: 0 }),
      guardrails: [fakeGuardrail("r", false, { pass: false })],
      win,
    });
    expect((await pipeline.runCheck(ctx())).win).toBe(false);
  });

  it("does not win when the referee rejects", async () => {
    const referee = fakeReferee({ approved: false, reasons: ["too similar"] });
    const pipeline = createPipeline({
      scorer: fakeScorer({ score: 0 }),
      guardrails: [],
      referee,
      win,
    });
    const outcome = await pipeline.runCheck(ctx());
    expect(outcome.win).toBe(false);
    expect(outcome.referee).toEqual({ approved: false, reasons: ["too similar"] });
  });

  it("honours a different configured threshold", async () => {
    const pipeline = createPipeline({
      scorer: fakeScorer({ score: 4 }),
      guardrails: [],
      win: { scoreAtOrBelow: 4 },
    });
    expect((await pipeline.runCheck(ctx())).win).toBe(true);
  });
});
