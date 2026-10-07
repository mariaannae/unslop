import { describe, expect, it, vi } from "vitest";
import {
  checkRules,
  createGame,
  runCheck,
  type CheckOutcome,
  type EvalContext,
  type GuardrailResult,
  type Passage,
  type ScoreResult,
} from "./game";

// Test doubles. Every function is a spy so ordering can be asserted.

const ctx = (overrides: Partial<EvalContext> = {}): EvalContext => ({
  original: "one two three four five six seven eight nine ten",
  current: "one two three four five six seven eight nine ten",
  ...overrides,
});

function fakeScorer(result: ScoreResult | Error = { score: 5 }) {
  return {
    score: vi.fn(async (_ctx: EvalContext): Promise<ScoreResult> => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

function fakeGuardrail(id: string, local: boolean, result: GuardrailResult = { pass: true }) {
  return { id, local, check: vi.fn(async (_ctx: EvalContext, _score?: ScoreResult) => result) };
}

const passages: Passage[] = [
  { id: "a", text: "alpha alpha alpha alpha" },
  { id: "b", text: "bravo bravo bravo bravo" },
  { id: "c", text: "charlie charlie charlie charlie" },
];

/** Cycles through the bank in order, honouring excludeId, so tests are deterministic. */
function sequentialDraw(bank: Passage[] = passages) {
  let index = 0;
  return vi.fn(async (excludeId?: string) => {
    for (let tries = 0; tries < bank.length; tries++) {
      const candidate = bank[index++ % bank.length]!;
      if (candidate.id !== excludeId) return candidate;
    }
    return bank[0]!;
  });
}

const win = { scoreAtOrBelow: 2 };

describe("check ordering", () => {
  it("a failing local guardrail stops before the scorer and consumes nothing", async () => {
    const scorer = fakeScorer({ score: 0 });
    const local = fakeGuardrail("local", true, { pass: false, reason: "no" });
    const remote = fakeGuardrail("remote", false);

    const outcome = await runCheck(ctx(), { scorer, guardrails: [local, remote], win });

    expect(scorer.score).not.toHaveBeenCalled();
    expect(remote.check).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      guardrails: [{ id: "local", result: { pass: false, reason: "no" } }],
      win: false,
      checkConsumed: false,
    });
  });

  it("runs every local guardrail even after one fails, so feedback is complete", async () => {
    const a = fakeGuardrail("a", true, { pass: false, reason: "a" });
    const b = fakeGuardrail("b", true, { pass: false, reason: "b" });

    const outcome = await runCheck(ctx(), { scorer: fakeScorer(), guardrails: [a, b], win });

    expect(outcome.guardrails.map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("runs the scorer when local guardrails pass and marks the check consumed", async () => {
    const scorer = fakeScorer({ score: 7 });

    const outcome = await runCheck(ctx({ current: "edited" }), {
      scorer,
      guardrails: [fakeGuardrail("l", true)],
      win,
    });

    expect(scorer.score).toHaveBeenCalledWith(ctx({ current: "edited" }));
    expect(outcome.score).toEqual({ score: 7 });
    expect(outcome.checkConsumed).toBe(true);
  });

  it("runs remote guardrails after the scorer and hands them the ScoreResult", async () => {
    const order: string[] = [];
    const scorer = fakeScorer();
    scorer.score.mockImplementation(async () => {
      order.push("scorer");
      return { score: 1, raw: { meaning_preserved: false } };
    });
    const remote = fakeGuardrail("remote", false);
    remote.check.mockImplementation(async () => {
      order.push("remote");
      return { pass: true };
    });

    const outcome = await runCheck(ctx(), { scorer, guardrails: [remote], win });

    expect(order).toEqual(["scorer", "remote"]);
    expect(remote.check).toHaveBeenCalledWith(ctx(), {
      score: 1,
      raw: { meaning_preserved: false },
    });
    expect(outcome.guardrails).toEqual([{ id: "remote", result: { pass: true } }]);
  });

  it("calls local guardrails without a score argument", async () => {
    const local = fakeGuardrail("local", true);

    await runCheck(ctx(), { scorer: fakeScorer(), guardrails: [local], win });

    expect(local.check).toHaveBeenCalledTimes(1);
    expect(local.check.mock.calls[0]).toHaveLength(1);
  });

  it("a failing remote guardrail blocks the win but still spends the check", async () => {
    const remote = fakeGuardrail("remote", false, { pass: false, reason: "meaning changed" });

    const outcome = await runCheck(ctx(), {
      scorer: fakeScorer({ score: 0 }),
      guardrails: [remote],
      win,
    });

    expect(outcome.win).toBe(false);
    expect(outcome.checkConsumed).toBe(true);
    expect(outcome.guardrails).toEqual([
      { id: "remote", result: { pass: false, reason: "meaning changed" } },
    ]);
  });

  it("propagates scorer errors instead of swallowing them", async () => {
    const scorer = fakeScorer(new Error("provider down"));
    await expect(runCheck(ctx(), { scorer, guardrails: [], win })).rejects.toThrow("provider down");
  });
});

describe("win logic", () => {
  it("wins on score at threshold with every guardrail passing", async () => {
    const outcome = await runCheck(ctx(), {
      scorer: fakeScorer({ score: 2 }),
      guardrails: [fakeGuardrail("l", true), fakeGuardrail("r", false)],
      win,
    });
    expect(outcome.win).toBe(true);
  });

  it("does not win above the threshold", async () => {
    const outcome = await runCheck(ctx(), {
      scorer: fakeScorer({ score: 3 }),
      guardrails: [],
      win,
    });
    expect(outcome.win).toBe(false);
  });

  it("does not win when a guardrail fails, even at score 0", async () => {
    const outcome = await runCheck(ctx(), {
      scorer: fakeScorer({ score: 0 }),
      guardrails: [fakeGuardrail("r", false, { pass: false })],
      win,
    });
    expect(outcome.win).toBe(false);
  });

  it("honours a different configured threshold", async () => {
    const outcome = await runCheck(ctx(), {
      scorer: fakeScorer({ score: 4 }),
      guardrails: [],
      win: { scoreAtOrBelow: 4 },
    });
    expect(outcome.win).toBe(true);
  });
});

function gameWith(
  scorer = fakeScorer({ score: 5 }),
  checksPerPuzzle = 3,
  other = fakeScorer({ score: 1 }),
) {
  const local = fakeGuardrail("not-empty", true);
  local.check.mockImplementation(async (c) =>
    c.current.trim() ? { pass: true } : { pass: false, reason: "empty" },
  );
  const drawPassage = sequentialDraw();
  const game = createGame({
    drawPassage,
    scorers: [
      { id: "main", label: "Main", scorer, win },
      { id: "other", label: "Other", scorer: other, win: { scoreAtOrBelow: 1 } },
    ],
    defaultScorer: "main",
    guardrails: [local],
    budget: { checksPerPuzzle },
  });
  return { game, scorer, other, drawPassage };
}

describe("game state: passages", () => {
  it("starts loading with no passage and draws one on newPassage", async () => {
    const { game, drawPassage } = gameWith();
    expect(game.getState()).toMatchObject({ phase: "loading", passage: null, current: "" });

    await game.newPassage();

    expect(drawPassage).toHaveBeenCalledWith(undefined);
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
    const { game, drawPassage } = gameWith();
    await game.newPassage();
    await game.newPassage();
    expect(drawPassage).toHaveBeenLastCalledWith("a");
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

  it("passes the original and the current edit to the scorer", async () => {
    const scorer = fakeScorer({ score: 9 });
    const { game } = gameWith(scorer);
    await game.newPassage();
    game.setCurrent("my edit");
    await game.check();
    game.setCurrent("second edit");
    await game.check();
    expect(scorer.score).toHaveBeenLastCalledWith({
      original: passages[0]!.text,
      current: "second edit",
    });
  });
});

describe("game state: choosing a scorer", () => {
  it("starts with the default scorer and checks with it", async () => {
    const { game, scorer, other } = gameWith();
    expect(game.getState().scorerId).toBe("main");
    await game.newPassage();
    await game.check();
    expect(scorer.score).toHaveBeenCalledTimes(1);
    expect(other.score).not.toHaveBeenCalled();
  });

  it("switching restarts the passage and checks with the new scorer and its win line", async () => {
    const { game, scorer, other } = gameWith(fakeScorer({ score: 9 }), 3, fakeScorer({ score: 1 }));
    await game.newPassage();
    game.setCurrent("my edit");
    await game.check();

    game.setScorer("other");

    expect(game.getState()).toMatchObject({
      scorerId: "other",
      phase: "playing",
      passage: passages[0],
      current: passages[0]!.text,
      checksUsed: 0,
      outcome: null,
    });
    const outcome = (await game.check()) as CheckOutcome;
    expect(other.score).toHaveBeenCalledTimes(1);
    expect(scorer.score).toHaveBeenCalledTimes(1);
    expect(outcome.win).toBe(true); // 1 is at the other scorer's line of 1
  });

  it("can switch after a puzzle is over, which replays the same passage", async () => {
    const { game } = gameWith(fakeScorer({ score: 9 }), 1);
    await game.newPassage();
    await game.check();
    expect(game.getState().phase).toBe("lost");

    game.setScorer("other");

    expect(game.getState()).toMatchObject({ phase: "playing", passage: passages[0] });
  });

  it("is ignored mid-check, and only records the choice while a passage loads", async () => {
    let finish!: (r: ScoreResult) => void;
    const slow = { score: vi.fn(() => new Promise<ScoreResult>((resolve) => (finish = resolve))) };
    const { game } = gameWith(slow);
    game.setScorer("other");
    expect(game.getState()).toMatchObject({ scorerId: "other", phase: "loading", passage: null });

    game.setScorer("main");
    await game.newPassage();
    const pending = game.check();
    await Promise.resolve();
    game.setScorer("other");
    expect(game.getState()).toMatchObject({ scorerId: "main", phase: "checking" });
    finish({ score: 5 });
    await pending;
  });

  it("rejects an unknown scorer id, in the config and when switching", () => {
    const { game } = gameWith();
    expect(() => game.setScorer("nope")).toThrow('Unknown scorer "nope". Known: main, other');
    expect(() =>
      createGame({
        drawPassage: sequentialDraw(),
        scorers: [],
        defaultScorer: "main",
        guardrails: [],
        budget: { checksPerPuzzle: 1 },
      }),
    ).toThrow('Unknown scorer "main"');
  });

  it("checkRules pairs the chosen scorer with its own win line and the guardrails", () => {
    const scorer = fakeScorer();
    const guardrail = fakeGuardrail("g", true);
    const rules = checkRules(
      {
        scorers: [{ id: "x", label: "X", scorer, win: { scoreAtOrBelow: 3 } }],
        guardrails: [guardrail],
      },
      "x",
    );
    expect(rules).toEqual({ scorer, guardrails: [guardrail], win: { scoreAtOrBelow: 3 } });
  });
});
