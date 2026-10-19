import { describe, expect, it } from "vitest";
import { segments, tellAt, tellLabel, trackTells } from "./feedback";

const checked = "A truly magical hobby, offering clear skies, calm nights, and quiet.";

describe("trackTells", () => {
  it("finds each quote in the current text, at every place it appears", () => {
    const current = "Truly magical, truly magical.";
    const [tell] = trackTells(checked, [{ label: "x", quote: "truly magical" }], current);
    expect(tell).toMatchObject({ tracked: true, ranges: [[15, 28]], edited: false });

    const twice = trackTells("ab ab", [{ label: "x", quote: "ab" }], "ab ab");
    expect(twice[0]!.ranges).toEqual([
      [0, 2],
      [3, 5],
    ]);
  });

  it("gives tells that share a quote one place each, in order", () => {
    const dash = { label: "em-dash", quote: "—" };
    const three = trackTells("a — b — c — d", [dash, dash], "a — b — c — d");
    expect(three.map((t) => t.ranges)).toEqual([
      [[2, 3]],
      [
        [6, 7],
        [10, 11],
      ],
    ]);
    const one = trackTells("a — b — c", [dash, dash], "a — b, c");
    expect(one.map((t) => [t.ranges, t.edited])).toEqual([
      [[[2, 3]], false],
      [[], true],
    ]);
  });

  it("marks a tracked tell edited once its quote is gone", () => {
    const [tell] = trackTells(checked, [{ label: "x", quote: "truly magical" }], "A fun hobby.");
    expect(tell).toMatchObject({ tracked: true, ranges: [], edited: true });
  });

  it("does not track tells with no quote, or a quote that was never in the checked text", () => {
    const tells = trackTells(
      checked,
      [
        { label: "Uniform sentence length" },
        { label: "Stock AI vocabulary", quote: "vibrant, serves as" },
      ],
      "anything",
    );
    expect(tells.map((t) => [t.tracked, t.edited])).toEqual([
      [false, false],
      [false, false],
    ]);
  });
});

describe("segments", () => {
  it("covers the whole text, splitting at each range edge so overlaps keep both tells", () => {
    const text = "clear skies, calm nights, and quiet";
    const tells = trackTells(
      text,
      [
        { label: "list", quote: "clear skies, calm nights, and quiet" },
        { label: "phrase", quote: "calm nights" },
      ],
      text,
    );
    const parts = segments(text, tells);
    expect(parts.map((p) => p.text).join("")).toBe(text);
    expect(parts.map((p) => [p.text, p.tells])).toEqual([
      ["clear skies, ", [0]],
      ["calm nights", [0, 1]],
      [", and quiet", [0]],
    ]);
  });

  it("returns the text as one plain segment when nothing is highlighted", () => {
    expect(segments("plain", [])).toEqual([{ start: 0, text: "plain", tells: [] }]);
    expect(segments("", [])).toEqual([]);
  });
});

describe("tellAt", () => {
  const text = "clear skies, calm nights, and quiet";
  const tells = trackTells(
    text,
    [
      { label: "list", quote: "clear skies, calm nights, and quiet" },
      { label: "phrase", quote: "calm nights" },
    ],
    text,
  );

  it("picks the shortest quote holding the cursor, ends included", () => {
    expect(tellAt(tells, 0)).toBe(0);
    expect(tellAt(tells, 15)).toBe(1);
    expect(tellAt(tells, 24)).toBe(1); // just after "nights"
    expect(tellAt(tells, text.length)).toBe(0);
  });

  it("returns null outside every quote", () => {
    expect(tellAt(trackTells("ab cd", [{ label: "x", quote: "ab" }], "ab cd"), 4)).toBeNull();
  });
});

describe("tellLabel", () => {
  it("turns kebab-case labels into words and leaves others alone", () => {
    expect(tellLabel("stock-phrasing")).toBe("Stock phrasing");
    expect(tellLabel("burstiness")).toBe("Burstiness");
    expect(tellLabel("Em-dash habit")).toBe("Em-dash habit");
    expect(tellLabel("Reads as AI-written")).toBe("Reads as AI-written");
  });
});
