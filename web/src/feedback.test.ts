import { describe, expect, it } from "vitest";
import {
  beatNotes,
  findEdit,
  formatScore,
  headlineFor,
  lastHit,
  moveRanges,
  segments,
  tellAt,
  tellLabel,
  trackTells,
  trailMark,
} from "./feedback";
import type { CheckRecord, Tell } from "./game";

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

  it("lets different tells on one phrase all mark it, so none looks edited", () => {
    const quote = "offering clear skies";
    const tells = trackTells(
      checked,
      [
        { label: "generic-filler", quote },
        { label: "tacked-on-ing-phrase", quote },
      ],
      checked,
    );
    expect(tells.map((t) => [t.ranges, t.edited])).toEqual([
      [[[23, 43]], false],
      [[[23, 43]], false],
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
    expect(segments("plain", [])).toEqual([{ start: 0, text: "plain", tells: [], changed: false }]);
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

describe("findEdit", () => {
  it("finds an insert, a delete and a replace", () => {
    expect(findEdit("ab", "aXb", 2)).toEqual({ at: 1, removed: 0, inserted: "X" });
    expect(findEdit("aXb", "ab", 1)).toEqual({ at: 1, removed: 1, inserted: "" });
    expect(findEdit("the big red dog", "the big blue dog", 12)).toEqual({
      at: 8,
      removed: 3,
      inserted: "blue",
    });
  });

  it("uses the cursor to place a change inside a run of equal characters", () => {
    expect([1, 2, 3].map((caret) => findEdit("aab", "aaab", caret).at)).toEqual([0, 1, 2]);
    expect(findEdit("aaab", "aab", 1)).toEqual({ at: 1, removed: 1, inserted: "" });
    expect(findEdit("aab", "aaab", null).at).toBe(2);
  });

  it("does not widen a change made behind the cursor", () => {
    expect(findEdit("one two three", "one 2 three", 11)).toEqual({
      at: 4,
      removed: 3,
      inserted: "2",
    });
  });

  it("keeps surrogate pairs whole", () => {
    expect(findEdit("a😀b", "a😃b", 3)).toEqual({ at: 1, removed: 2, inserted: "😃" });
  });

  it("takes a selection typed or pasted over as the change, even where the text matches", () => {
    const dog = "the big red dog";
    expect(findEdit(dog, dog, dog.length, [0, dog.length])).toEqual({
      at: 0,
      removed: 15,
      inserted: dog,
    });
    expect(findEdit(dog, "the b dog", 5, [4, 11])).toEqual({ at: 4, removed: 7, inserted: "b" });
    // A selection that does not fit the change is ignored.
    expect(findEdit(dog, "the big red dogs", 16, [0, 3])).toEqual({
      at: 15,
      removed: 0,
      inserted: "s",
    });
  });

  it("returns an empty edit when nothing changed", () => {
    expect(findEdit("abc", "abc", 1)).toEqual({ at: 1, removed: 0, inserted: "" });
  });
});

/**
 * Plays edits as the UI does: each step is the text after it, where it left the
 * cursor, and whether the player was still typing there (default true).
 */
function play(
  checked: string,
  tells: Tell[],
  steps: Array<[after: string, caret: number, typing?: boolean]>,
) {
  let text = checked;
  let tracked = trackTells(checked, tells, text);
  for (const [after, caret, typing = true] of steps) {
    const places = moveRanges(tracked, findEdit(text, after, caret), typing);
    text = after;
    tracked = trackTells(checked, tells, text, places);
  }
  return tracked;
}

describe("moveRanges", () => {
  const dog = "the big red dog";
  const bigRed = [{ label: "x", quote: "big red" }];
  it("starts from the quote's place", () => {
    expect(play(dog, bigRed, [])[0]!.ranges).toEqual([[4, 11]]);
  });

  it("shifts a range after an edit before it, and leaves it after an edit after it", () => {
    expect(play(dog, bigRed, [["XXthe big red dog", 2]])[0]!.ranges).toEqual([[6, 13]]);
    expect(play(dog, bigRed, [["the big red dog!", 16]])[0]!.ranges).toEqual([[4, 11]]);
  });

  it("does not spread an untouched range to text typed at its edges", () => {
    const before = play(dog, bigRed, [["the Xbig red dog", 5]])[0]!;
    expect(before).toMatchObject({ ranges: [[5, 12]], changed: [false], edited: false });
    const after = play(dog, bigRed, [["the big redX dog", 12]])[0]!;
    expect(after).toMatchObject({ ranges: [[4, 11]], changed: [false], edited: false });
  });

  it("takes in a replace inside, across either end, or over the whole range", () => {
    const inside = play(dog, bigRed, [["the big blue dog", 12]])[0]!;
    expect(inside).toMatchObject({ ranges: [[4, 12]], now: ["big blue"], edited: true });
    const start = play(dog, bigRed, [["a huge red dog", 6]])[0]!;
    expect(start).toMatchObject({ ranges: [[0, 10]], now: ["a huge red"], edited: true });
    const end = play(dog, bigRed, [["the big cat", 11]])[0]!;
    expect(end).toMatchObject({ ranges: [[4, 11]], now: ["big cat"], edited: true });
    const whole = play(dog, bigRed, [["the x dog", 5]])[0]!;
    expect(whole).toMatchObject({ ranges: [[4, 5]], now: ["x"], edited: true });
  });

  it("leaves an empty range where the phrase was deleted", () => {
    const [tell] = play(dog, bigRed, [["the  dog", 4]]);
    expect(tell).toMatchObject({ ranges: [[4, 4]], now: [""], changed: [true], edited: true });
    expect(tellAt([tell!], 4)).toBe(0);
  });

  it("grows a changed range with text typed at its edge only while typing there", () => {
    const typing = play(dog, bigRed, [
      ["the x dog", 5],
      ["the xy dog", 6],
    ]);
    expect(typing[0]!.now).toEqual(["xy"]);
    const later = play(dog, bigRed, [
      ["the x dog", 5],
      ["the xy dog", 6, false],
    ]);
    expect(later[0]!.now).toEqual(["x"]);
  });

  it("takes in a phrase retyped where one was deleted, until the cursor moves", () => {
    const retyped = play(dog, bigRed, [
      ["the  dog", 4],
      ["the huge dog", 8],
    ]);
    expect(retyped[0]).toMatchObject({ ranges: [[4, 8]], now: ["huge"], edited: true });
    const elsewhere = play(dog, bigRed, [
      ["the  dog", 4],
      ["the huge dog", 8, false],
    ]);
    expect(elsewhere[0]).toMatchObject({ ranges: [[4, 4]], now: [""], edited: true });
  });

  it("gives a paste across two ranges to both", () => {
    const text = "one big red dog and a cool cat";
    const tells = play(
      text,
      [
        { label: "x", quote: "big red" },
        { label: "y", quote: "cool cat" },
      ],
      [["one big X cat", 9]],
    );
    expect(tells.map((t) => [t.ranges, t.edited])).toEqual([
      [[[4, 9]], true],
      [[[8, 13]], true],
    ]);
    expect(segments("one big X cat", tells).map((s) => [s.text, s.tells, s.changed])).toEqual([
      ["one ", [], false],
      ["big ", [0], true],
      ["X", [0, 1], true],
      [" cat", [1], true],
    ]);
  });
});

describe("trackTells with carried ranges", () => {
  const dog = "the big red dog";
  const bigRed = [{ label: "x", quote: "big red" }];

  it("counts a quote retyped exactly as untouched", () => {
    const [tell] = play(dog, bigRed, [
      ["the  dog", 4],
      ["the big red dog", 11],
    ]);
    expect(tell).toMatchObject({ ranges: [[4, 11]], changed: [false], edited: false });
  });

  it("snaps a range that still holds the quote back to it", () => {
    const [tell] = trackTells(dog, bigRed, dog, [[[0, 15]]]);
    expect(tell).toMatchObject({ ranges: [[4, 11]], now: ["big red"], changed: [false] });
  });

  it("finds a quote again after it is cut and pasted elsewhere", () => {
    const [tell] = play("the big red dog. A cat.", bigRed, [
      ["A cat.", 0, false],
      ["A cat. the big red dog.", 23, false],
    ]);
    expect(tell).toMatchObject({
      ranges: [
        [0, 0],
        [11, 18],
      ],
      changed: [true, false],
      edited: false,
    });
  });

  it("keeps each repeated tell on its own place", () => {
    const dash = { label: "em-dash", quote: "—" };
    const carried = play("a — b — c — d", [dash, dash, dash], [["a b — c — d", 2]]);
    expect(carried.map((t) => t.edited)).toEqual([true, false, false]);
    // Search alone cannot tell which dash went, and crosses off the last.
    const searched = trackTells("a — b — c — d", [dash, dash, dash], "a b — c — d");
    expect(searched.map((t) => t.edited)).toEqual([false, false, true]);
  });
});

describe("segments with carried ranges", () => {
  it("adds no split for an empty range", () => {
    const tells = trackTells("the big red dog", [{ label: "x", quote: "big red" }], "the  dog", [
      [[4, 4]],
    ]);
    expect(segments("the  dog", tells)).toEqual([
      { start: 0, text: "the  dog", tells: [], changed: false },
    ]);
  });

  it("marks a run changed only when every range covering it is", () => {
    const tells = trackTells(
      "the big red dog",
      [
        { label: "outer", quote: "big red dog" },
        { label: "inner", quote: "big" },
      ],
      "the big blue dog",
      [[[4, 16]], [[4, 7]]],
    );
    expect(segments("the big blue dog", tells).map((s) => [s.text, s.tells, s.changed])).toEqual([
      ["the ", [], false],
      ["big", [0, 1], false],
      [" blue dog", [0], true],
    ]);
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

describe("trailMark", () => {
  const check = (score: number, pass = true): CheckRecord => ({
    text: "",
    outcome: {
      score: { score },
      guardrails: [{ id: "meaning", result: { pass } }],
      win: false,
      checkConsumed: true,
    },
  });

  it("marks a Check under the goal, blocked by a guardrail, or over", () => {
    expect(trailMark(check(5), 5)).toBe("under");
    expect(trailMark(check(5.1), 5)).toBe("over");
    expect(trailMark(check(2, false), 5)).toBe("blocked");
    expect(trailMark(check(9, false), 5)).toBe("blocked");
  });
});

describe("formatScore", () => {
  it("shows whole numbers plain and others to one decimal", () => {
    expect([7, 7.1, 7.1 - 5.3, 0.04, 9.96].map(formatScore)).toEqual([
      "7",
      "7.1",
      "1.8",
      "0",
      "10",
    ]);
  });
});

describe("lastHit", () => {
  const record = (score: number, pass = true, opening = false): CheckRecord => ({
    text: "",
    outcome: {
      score: { score },
      guardrails: [{ id: "meaning", result: { pass } }],
      win: false,
      checkConsumed: true,
    },
    ...(opening ? { opening } : {}),
  });

  it("says nothing before a Check, or for the opening one", () => {
    expect(lastHit([], null)).toBeNull();
    const opening = record(9, true, true);
    expect(lastHit([opening], opening.outcome)).toBeNull();
  });

  it("calls a drop better and a rise or no change worse, with the change", () => {
    const [start, down, up, same] = [record(9, true, true), record(6.5), record(7), record(7)];
    expect(lastHit([start, down], down.outcome)).toEqual({ kind: "better", text: "-2.5" });
    expect(lastHit([start, down, up], up.outcome)).toEqual({ kind: "worse", text: "+0.5" });
    expect(lastHit([start, down, up, same], same.outcome)).toEqual({ kind: "worse", text: "+0" });
  });

  it("calls a guardrail block, local or remote, blocked", () => {
    const [start, blocked] = [record(9, true, true), record(3, false)];
    expect(lastHit([start, blocked], blocked.outcome)?.kind).toBe("blocked");
    const refused = {
      guardrails: [{ id: "length-ratio", result: { pass: false } }],
      win: false,
      checkConsumed: false,
    };
    expect(lastHit([start], refused)?.kind).toBe("blocked");
  });
});

describe("beatNotes", () => {
  it("holds each sentence's note as long as the sentence, lower the longer it is", () => {
    const [short, long] = beatNotes([4, 30]);
    expect(short!.start).toBe(0);
    expect(short!.length).toBeCloseTo(0.14);
    expect(long!.start).toBeCloseTo(0.21);
    expect(long!.length).toBeCloseTo(1.05);
    expect(long!.frequency).toBeLessThan(short!.frequency);
  });

  it("plays sentences of one length as the same note, like a metronome", () => {
    const notes = beatNotes([18, 18, 18]);
    expect(new Set(notes.map((n) => `${n.length}/${n.frequency}`)).size).toBe(1);
  });

  it("keeps very short and very long sentences audible and bounded", () => {
    const [tiny, huge] = beatNotes([1, 200]);
    expect(tiny!.length).toBe(0.09);
    expect(huge!.length).toBe(1.4);
  });
});

describe("headlineFor", () => {
  const record = (score: number, verdict?: string, opening = false): CheckRecord => ({
    text: "",
    outcome: {
      score: { score },
      guardrails: verdict
        ? [{ id: "meaning-jev", result: { pass: false, verdict } }]
        : [{ id: "meaning-jev", result: { pass: true, verdict: "Meaning kept" } }],
      win: false,
      checkConsumed: true,
    },
    ...(opening ? { opening } : {}),
  });
  const start = record(9, undefined, true);

  it("says nothing before a Check, or for the opening one", () => {
    expect(headlineFor([], null)).toBeNull();
    expect(headlineFor([start], start.outcome)).toBeNull();
  });

  it("praises a good drop and nudges a small one", () => {
    const good = record(7.5);
    expect(headlineFor([start, good], good.outcome)).toEqual({
      kind: "good",
      lines: ["NOT BAD, HUMAN"],
    });
    const small = record(8.5);
    expect(headlineFor([start, small], small.outcome)).toEqual({
      kind: "meh",
      lines: ["NOT QUITE"],
    });
  });

  it("types two of NONSLOP's error lines when the score did not drop, turning each Check", () => {
    const [same, up] = [record(9), record(9.5)];
    const first = headlineFor([start, same], same.outcome)!;
    const second = headlineFor([start, same, up], up.outcome)!;
    expect(first.kind).toBe("error");
    expect(first.lines).toHaveLength(2);
    expect(second.lines[0]).toBe(first.lines[1]);
  });

  it("names the verdicts that blocked a Check, and a refusal that spent none", () => {
    const blocked = record(4, "Meaning changed");
    expect(headlineFor([start, blocked], blocked.outcome)).toEqual({
      kind: "error",
      lines: ["ERROR: MEANING CHANGED", "CRITICAL: ALL VERDICTS MUST PASS"],
    });
    const refused = {
      guardrails: [{ id: "length-ratio", result: { pass: false, reason: "Too short" } }],
      win: false,
      checkConsumed: false,
    };
    expect(headlineFor([start], refused)?.lines).toEqual(["ERROR: CHECK REFUSED", "NO CHECK USED"]);
  });
});
