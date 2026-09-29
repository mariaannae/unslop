import { describe, expect, it, vi } from "vitest";
import { createGame, createGameFromConfig } from "./gameState";
import { createPipeline } from "./pipeline";
import { createRegistry } from "./registry";
import type { CheckOutcome } from "./types";
import {
  ctx,
  fakeGuardrail,
  fakeReferee,
  fakeScorer,
  passages,
  sequentialSource,
} from "../test/fakes";

const win = { scoreAtOrBelow: 2 };

function gameWith(scorer = fakeScorer({ score: 5 }), checksPerPuzzle = 3) {
  const local = fakeGuardrail("not-empty", true);
  local.check.mockImplementation(async (c) =>
    c.current.trim() ? { pass: true } : { pass: false, reason: "empty" },
  );
  const pipeline = createPipeline({ scorer, guardrails: [local], win });
  const passageSource = sequentialSource();
  const game = createGame({ pipeline, passageSource, checksPerPuzzle });
  return { game, scorer, passageSource };
}

describe("game state: passages", () => {
  it("starts loading with no passage and draws one on newPassage", async () => {
    const { game, passageSource } = gameWith();
    expect(game.getState()).toMatchObject({ phase: "loading", passage: null, current: "" });

    await game.newPassage();

    expect(passageSource.getRandom).toHaveBeenCalledWith(undefined);
    expect(game.getState()).toMatchObject({
      phase: "playing",
      passage: passages[0],
      current: passages[0]!.text,
      checksUsed: 0,
      outcome: null,
      error: null,
    });
  });

  it("passes the current passage id as excludeId on the next draw", async () => {
    const { game, passageSource } = gameWith();
    await game.newPassage();
    await game.newPassage();
    expect(passageSource.getRandom).toHaveBeenLastCalledWith("a");
    expect(game.getState().passage?.id).toBe("b");
  });

  it("notifies subscribers on every change and stops after unsubscribe", async () => {
    const { game } = gameWith();
    const listener = vi.fn();
    const unsubscribe = game.subscribe(listener);
    await game.newPassage();
    expect(listener).toHaveBeenCalled();
    const calls = listener.mock.calls.length;
    unsubscribe();
    game.setCurrent("x");
    expect(listener).toHaveBeenCalledTimes(calls);
  });
});

describe("game state: budget", () => {
  it("a successful check consumes exactly one unit", async () => {
    const { game } = gameWith();
    await game.newPassage();
    await game.check();
    expect(game.getState().checksUsed).toBe(1);
    expect(game.getState().outcome?.score).toEqual({ score: 5 });
  });

  it("a local guardrail failure consumes nothing", async () => {
    const { game, scorer } = gameWith();
    await game.newPassage();
    game.setCurrent("   ");
    const outcome = await game.check();
    expect(outcome?.checkConsumed).toBe(false);
    expect(scorer.score).not.toHaveBeenCalled();
    expect(game.getState().checksUsed).toBe(0);
    expect(game.getState().outcome?.guardrails[0]?.result.reason).toBe("empty");
  });

  it("a scorer failure consumes nothing, surfaces the error, and returns to playing", async () => {
    const { game } = gameWith(fakeScorer(new Error("provider down")));
    await game.newPassage();
    const outcome = await game.check();
    expect(outcome).toBeNull();
    expect(game.getState()).toMatchObject({
      phase: "playing",
      checksUsed: 0,
      error: "provider down",
    });
  });

  it("clears a previous error on the next edit", async () => {
    const { game } = gameWith(fakeScorer(new Error("provider down")));
    await game.newPassage();
    await game.check();
    game.setCurrent("fixed");
    expect(game.getState().error).toBeNull();
  });

  it("budget exhaustion moves to lost and refuses further checks", async () => {
    const { game, scorer } = gameWith(fakeScorer({ score: 9 }), 2);
    await game.newPassage();
    await game.check();
    expect(game.getState().phase).toBe("playing");
    await game.check();
    expect(game.getState()).toMatchObject({ phase: "lost", checksUsed: 2 });

    const refused = await game.check();
    expect(refused).toBeNull();
    expect(scorer.score).toHaveBeenCalledTimes(2);
    expect(game.getState().checksUsed).toBe(2);
  });

  it("ignores edits once the puzzle is over", async () => {
    const { game } = gameWith(fakeScorer({ score: 9 }), 1);
    await game.newPassage();
    await game.check();
    game.setCurrent("changed");
    expect(game.getState().current).toBe(passages[0]!.text);
  });

  it("new passage resets the budget and clears the prior outcome", async () => {
    const { game } = gameWith(fakeScorer({ score: 9 }), 1);
    await game.newPassage();
    await game.check();
    expect(game.getState().phase).toBe("lost");

    await game.newPassage();

    expect(game.getState()).toMatchObject({
      phase: "playing",
      checksUsed: 0,
      outcome: null,
      error: null,
      current: passages[1]!.text,
    });
  });
});

describe("game state: winning", () => {
  it("a winning outcome moves to won even with checks remaining", async () => {
    const { game } = gameWith(fakeScorer({ score: 0 }), 3);
    await game.newPassage();
    const outcome = (await game.check()) as CheckOutcome;
    expect(outcome.win).toBe(true);
    expect(game.getState()).toMatchObject({ phase: "won", checksUsed: 1 });
    expect(await game.check()).toBeNull();
  });

  it("a win on the last check is a win, not a loss", async () => {
    const { game } = gameWith(fakeScorer({ score: 0 }), 1);
    await game.newPassage();
    await game.check();
    expect(game.getState().phase).toBe("won");
  });

  it("passes the puzzle id, original, current and checksUsed to the pipeline", async () => {
    const scorer = fakeScorer({ score: 9 });
    const { game } = gameWith(scorer);
    await game.newPassage();
    game.setCurrent("my edit");
    await game.check();
    game.setCurrent("second edit");
    await game.check();
    expect(scorer.score).toHaveBeenLastCalledWith(
      ctx({ puzzleId: "a", original: passages[0]!.text, current: "second edit", checksUsed: 1 }),
    );
  });
});

describe("createGameFromConfig", () => {
  const scorer = fakeScorer({ score: 0 });
  const referee = fakeReferee({ approved: false, reasons: ["nope"] });
  const registry = createRegistry({
    scorers: { s: () => scorer },
    guardrails: { g: () => fakeGuardrail("g", true) },
    referees: { r: () => referee },
    passageSources: { p: () => sequentialSource() },
  });
  const base = {
    passageSource: "p",
    scorer: "s",
    guardrails: ["g"],
    win: { scoreAtOrBelow: 2 },
    budget: { checksPerPuzzle: 4 },
    guardrailParams: {},
  };

  it("wires the configured referee in", async () => {
    const game = createGameFromConfig({ ...base, referee: "r" }, registry);
    await game.newPassage();
    const outcome = await game.check();
    expect(referee.verify).toHaveBeenCalled();
    expect(outcome?.win).toBe(false);
  });

  it("runs without a referee when none is configured", async () => {
    referee.verify.mockClear();
    const game = createGameFromConfig(base, registry);
    await game.newPassage();
    const outcome = await game.check();
    expect(referee.verify).not.toHaveBeenCalled();
    expect(outcome?.win).toBe(true);
    expect(game.getState().checksPerPuzzle).toBe(4);
  });

  it("fails at construction on an unknown id, not at first check", () => {
    expect(() => createGameFromConfig({ ...base, scorer: "missing" }, registry)).toThrow(
      /Unknown scorer "missing"/,
    );
  });
});
