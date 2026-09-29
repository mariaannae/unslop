import { describe, expect, it } from "vitest";
import { createStaticBank, validateBank } from "./staticBank";
import { passages } from "../test/fakes";

describe("static bank", () => {
  it("getRandom returns a passage from the bank", async () => {
    const source = createStaticBank(passages, () => 0.5);
    expect(passages).toContainEqual(await source.getRandom());
  });

  it("covers the whole bank as the random value sweeps 0..1", async () => {
    const ids = new Set<string>();
    for (const r of [0, 0.34, 0.67, 0.999]) {
      ids.add((await createStaticBank(passages, () => r).getRandom()).id);
    }
    expect(ids).toEqual(new Set(["a", "b", "c"]));
  });

  it("never returns the excluded passage when the bank has more than one entry", async () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const source = createStaticBank(passages, () => r);
      for (const exclude of ["a", "b", "c"]) {
        expect((await source.getRandom(exclude)).id).not.toBe(exclude);
      }
    }
  });

  it("returns the only passage even when it is excluded", async () => {
    const source = createStaticBank([passages[0]!], () => 0.3);
    expect((await source.getRandom("a")).id).toBe("a");
  });

  it("clamps a random value of exactly 1 into range", async () => {
    const source = createStaticBank(passages, () => 1);
    expect((await source.getRandom()).id).toBe("c");
  });

  it("loads the bundled bank by default", async () => {
    const source = createStaticBank();
    const passage = await source.getRandom();
    expect(passage.id).toMatch(/^p\d{4}$/);
    expect(passage.text.length).toBeGreaterThan(50);
  });

  it("rejects an empty bank", () => {
    expect(() => createStaticBank([])).toThrow(/empty/);
  });
});

describe("validateBank", () => {
  it("accepts well-formed entries and normalises topic", () => {
    expect(
      validateBank([
        { id: "x", text: "t" },
        { id: "y", text: "t", topic: "cats" },
      ]),
    ).toEqual([
      { id: "x", text: "t" },
      { id: "y", text: "t", topic: "cats" },
    ]);
  });

  it.each([
    ["not an array", {}, /must be an array/],
    ["missing id", [{ text: "t" }], /has no id/],
    [
      "duplicate id",
      [
        { id: "x", text: "t" },
        { id: "x", text: "u" },
      ],
      /duplicate/,
    ],
    ["empty text", [{ id: "x", text: "  " }], /has no text/],
  ])("rejects %s", (_name, input, message) => {
    expect(() => validateBank(input)).toThrow(message);
  });
});
