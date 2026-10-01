import { describe, expect, it } from "vitest";
import { runCheck, type EvalContext } from "./game";
import {
  countWords,
  grammar,
  lengthRatio,
  meaning,
  MEANING_CHANGED_REASON,
  NOT_GRAMMATICAL_REASON,
  notEmpty,
} from "./guardrails";

const ctx = (overrides: Partial<EvalContext> = {}): EvalContext => ({
  original: "one two three four five six seven eight nine ten",
  current: "one two three four five six seven eight nine ten",
  ...overrides,
});

describe("not-empty", () => {
  it("passes on visible text and fails on whitespace", async () => {
    expect(await notEmpty.check(ctx({ current: " a " }))).toEqual({ pass: true });
    expect(await notEmpty.check(ctx({ current: " \n\t" }))).toMatchObject({ pass: false });
    expect(await notEmpty.check(ctx({ current: "" }))).toMatchObject({ pass: false });
  });
});

describe("length-ratio", () => {
  const ten = "w w w w w w w w w w";
  const guardrail = lengthRatio({ min: 0.7, max: 1.3 });

  it("counts words across whitespace runs", () => {
    expect(countWords("  one\ttwo \n three  ")).toBe(3);
    expect(countWords("   ")).toBe(0);
  });

  it.each([
    [7, true],
    [6, false],
    [13, true],
    [14, false],
    [10, true],
  ])("with %s words against 10 passes=%s", async (n, pass) => {
    const result = await guardrail.check(
      ctx({ original: ten, current: Array(n).fill("x").join(" ") }),
    );
    expect(result.pass).toBe(pass);
  });

  it("explains the word target on failure", async () => {
    const short = await guardrail.check(ctx({ original: ten, current: "x" }));
    expect(short.reason).toBe("Too short: 1 words, needs at least 7.");
    const long = await guardrail.check(
      ctx({ original: ten, current: Array(20).fill("x").join(" ") }),
    );
    expect(long.reason).toBe("Too long: 20 words, needs at most 13.");
  });

  it("passes when the original has no words", async () => {
    expect(await guardrail.check(ctx({ original: "", current: "anything" }))).toEqual({
      pass: true,
    });
  });

  it("leaves blank text to not-empty, so the player gets one message", async () => {
    expect(await guardrail.check(ctx({ original: ten, current: " \n" }))).toEqual({ pass: true });
    const outcome = await runCheck(ctx({ original: ten, current: "" }), {
      scorer: { score: async () => ({ score: 0 }) },
      guardrails: [notEmpty, guardrail],
      win: { scoreAtOrBelow: 2 },
    });
    expect(outcome.guardrails.filter((g) => !g.result.pass)).toEqual([
      { id: "not-empty", result: { pass: false, reason: "The passage is empty." } },
    ]);
  });

  it("rejects bad bounds when it is created", () => {
    expect(() => lengthRatio({ min: 2, max: 1 })).toThrow(/invalid bounds/);
    expect(() => lengthRatio({ min: 0, max: 1 })).toThrow(/invalid bounds/);
  });
});

describe("meaning and grammar", () => {
  const judged = (raw: Record<string, unknown>) => ({
    scorer: { score: async () => ({ score: 0, raw }) },
    guardrails: [meaning, grammar],
    win: { scoreAtOrBelow: 2 },
  });

  it("run after the scorer, so the judge's verdict can block a winning score", async () => {
    const outcome = await runCheck(
      ctx(),
      judged({ meaning_preserved: false, grammatically_correct: true }),
    );
    expect(outcome.win).toBe(false);
    expect(outcome.guardrails).toEqual([
      { id: "meaning", result: { pass: false, reason: MEANING_CHANGED_REASON } },
      { id: "grammar", result: { pass: true } },
    ]);
  });

  it("report each problem separately when both fail", async () => {
    const outcome = await runCheck(
      ctx(),
      judged({ meaning_preserved: false, grammatically_correct: false }),
    );
    expect(outcome.guardrails).toEqual([
      { id: "meaning", result: { pass: false, reason: MEANING_CHANGED_REASON } },
      { id: "grammar", result: { pass: false, reason: NOT_GRAMMATICAL_REASON } },
    ]);
  });

  it("each fail only on their own field", async () => {
    const onlyGrammar = {
      score: 0,
      raw: { meaning_preserved: true, grammatically_correct: false },
    };
    expect(await meaning.check(ctx(), onlyGrammar)).toEqual({ pass: true });
    expect(await grammar.check(ctx(), onlyGrammar)).toEqual({
      pass: false,
      reason: NOT_GRAMMATICAL_REASON,
    });
  });

  it("pass when the score or raw payload is missing or lacks the fields", async () => {
    for (const guardrail of [meaning, grammar]) {
      expect(await guardrail.check(ctx())).toEqual({ pass: true });
      expect(await guardrail.check(ctx(), { score: 0 })).toEqual({ pass: true });
      expect(await guardrail.check(ctx(), { score: 0, raw: {} })).toEqual({ pass: true });
    }
  });
});
