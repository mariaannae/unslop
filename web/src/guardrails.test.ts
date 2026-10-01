import { describe, expect, it } from "vitest";
import { runCheck, type EvalContext } from "./game";
import {
  countWords,
  lengthRatio,
  MEANING_CHANGED_REASON,
  meaningFluency,
  NOT_FLUENT_REASON,
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

  it("rejects bad bounds when it is created", () => {
    expect(() => lengthRatio({ min: 2, max: 1 })).toThrow(/invalid bounds/);
    expect(() => lengthRatio({ min: 0, max: 1 })).toThrow(/invalid bounds/);
  });
});

describe("meaning-fluency", () => {
  it("runs after the scorer, so the judge's verdict can block a winning score", async () => {
    const scorer = {
      score: async () => ({ score: 0, raw: { meaning_preserved: false, fluent: true } }),
    };
    const outcome = await runCheck(ctx(), {
      scorer,
      guardrails: [meaningFluency],
      win: { scoreAtOrBelow: 2 },
    });
    expect(outcome.win).toBe(false);
    expect(outcome.guardrails).toEqual([
      { id: "meaning-fluency", result: { pass: false, reason: MEANING_CHANGED_REASON } },
    ]);
  });

  it("passes when both flags are true", async () => {
    const result = await meaningFluency.check(ctx(), {
      score: 0,
      raw: { meaning_preserved: true, fluent: true },
    });
    expect(result).toEqual({ pass: true });
  });

  it("fails with the meaning reason first when meaning is not preserved", async () => {
    const result = await meaningFluency.check(ctx(), {
      score: 0,
      raw: { meaning_preserved: false, fluent: false },
    });
    expect(result).toEqual({ pass: false, reason: MEANING_CHANGED_REASON });
  });

  it("fails with the fluency reason when only fluency is false", async () => {
    const result = await meaningFluency.check(ctx(), {
      score: 0,
      raw: { meaning_preserved: true, fluent: false },
    });
    expect(result).toEqual({ pass: false, reason: NOT_FLUENT_REASON });
  });

  it("passes when the score or raw payload is missing or lacks the fields", async () => {
    expect(await meaningFluency.check(ctx())).toEqual({ pass: true });
    expect(await meaningFluency.check(ctx(), { score: 0 })).toEqual({ pass: true });
    expect(await meaningFluency.check(ctx(), { score: 0, raw: {} })).toEqual({ pass: true });
  });
});
