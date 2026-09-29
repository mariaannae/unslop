import { describe, expect, it } from "vitest";
import { countWords, createLengthRatioGuardrail } from "./lengthRatio";
import { notEmptyGuardrail } from "./notEmpty";
import { ctx } from "../test/fakes";

describe("not-empty", () => {
  it("is local", () => expect(notEmptyGuardrail.local).toBe(true));

  it("passes on visible text and fails on whitespace", async () => {
    expect(await notEmptyGuardrail.check(ctx({ current: " a " }))).toEqual({ pass: true });
    expect(await notEmptyGuardrail.check(ctx({ current: " \n\t" }))).toMatchObject({ pass: false });
    expect(await notEmptyGuardrail.check(ctx({ current: "" }))).toMatchObject({ pass: false });
  });
});

describe("length-ratio", () => {
  const ten = "w w w w w w w w w w";
  const guardrail = createLengthRatioGuardrail({ min: 0.7, max: 1.3 });

  it("is local", () => expect(guardrail.local).toBe(true));

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

  it("falls back to defaults for missing params and rejects bad bounds", () => {
    expect(createLengthRatioGuardrail(undefined).id).toBe("length-ratio");
    expect(() => createLengthRatioGuardrail({ min: 2, max: 1 })).toThrow(/invalid bounds/);
    expect(() => createLengthRatioGuardrail({ min: 0, max: 1 })).toThrow(/invalid bounds/);
  });
});
