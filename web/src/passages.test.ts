import { describe, expect, it } from "vitest";
import type { Passage } from "./game";
import { createStaticBank, validateBank } from "./passages";

const passages: Passage[] = [
  { id: "a", text: "alpha alpha alpha alpha" },
  { id: "b", text: "bravo bravo bravo bravo" },
  { id: "c", text: "charlie charlie charlie charlie" },
];

describe("static bank", () => {
  it("draws a passage from the bank", async () => {
    const draw = createStaticBank(passages, () => 0.5);
    expect(passages).toContainEqual(await draw());
  });

  it("covers the whole bank as the random value sweeps 0..1", async () => {
    const ids = new Set<string>();
    for (const r of [0, 0.34, 0.67, 0.999]) {
      ids.add((await createStaticBank(passages, () => r)()).id);
    }
    expect(ids).toEqual(new Set(["a", "b", "c"]));
  });

  it("never returns the excluded passage when the bank has more than one entry", async () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const draw = createStaticBank(passages, () => r);
      for (const exclude of ["a", "b", "c"]) {
        expect((await draw(exclude)).id).not.toBe(exclude);
      }
    }
  });

  it("returns the only passage even when it is excluded", async () => {
    const draw = createStaticBank([passages[0]!], () => 0.3);
    expect((await draw("a")).id).toBe("a");
  });

  it("clamps a random value of exactly 1 into range", async () => {
    const draw = createStaticBank(passages, () => 1);
    expect((await draw()).id).toBe("c");
  });

  it("loads the bundled bank by default", async () => {
    const draw = createStaticBank();
    const passage = await draw();
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
