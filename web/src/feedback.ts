import type { CheckOutcome, CheckRecord, Tell } from "./game";

/**
 * Presentation helpers for the feedback the UI draws between Checks (spec B.43,
 * B.46): where the last Check's tells sit in the text being edited now, and which
 * of them the player has worked on. Nothing here decides a win; that stays in the
 * engine.
 */

/** A [start, end) span of the text. */
export type Range = [number, number];

/** A tell from the last Check, located in the current text. */
export type TrackedTell = {
  tell: Tell;
  /**
   * Whether its quote was in the text that was checked. Only these are
   * highlighted or crossed off: a quote that never matched (Jev's stock-vocabulary
   * list, say) cannot tell us anything about an edit.
   */
  tracked: boolean;
  /**
   * Where the quote was, in the current text. Found by search after a Check, then
   * carried through each edit (`moveRanges`), so a phrase the player rewrote keeps
   * its place. A deleted phrase leaves an empty range.
   */
  ranges: Range[];
  /** The text of each range now. */
  now: string[];
  /** For each range, whether its text no longer holds the quote: the player has worked on it. */
  changed: boolean[];
  /**
   * Tracked, and every range is changed: the player has worked on each place the
   * quote was. Only the next Check says if that helped.
   */
  edited: boolean;
};

/**
 * Locates the last Check's tells in `current`. Pass `places` (from `moveRanges`)
 * to keep the ranges carried through the player's edits; without it, each quote
 * is found by search.
 */
export function trackTells(
  checked: string,
  tells: readonly Tell[],
  current: string,
  places: readonly Range[][] = placeTells(checked, tells, current),
): TrackedTell[] {
  const located = tells.map((tell, i) => {
    const quote = tell.quote ?? "";
    const tracked = quote !== "" && checked.includes(quote);
    // An untouched range is the quote itself, even after typing beside it.
    const ranges = tracked
      ? (places[i] ?? []).map(([start, end]): Range => {
          const at = current.slice(start, end).indexOf(quote);
          return at === -1 ? [start, end] : [start + at, start + at + quote.length];
        })
      : [];
    return { tell, quote, tracked, ranges };
  });

  // A tell the player seems to have worked on everywhere, whose quote is still in
  // the text (cut and pasted, or put back by an undo), is found again: it takes the
  // first place no unchanged tell with the same label and quote holds.
  const held = new Map<string, Set<number>>();
  const holds = (tell: Tell) => {
    const set = held.get(key(tell)) ?? new Set<number>();
    held.set(key(tell), set);
    return set;
  };
  const unchanged = ({ quote }: { quote: string }, [start, end]: Range) =>
    current.slice(start, end) === quote;
  for (const t of located) {
    for (const range of t.ranges) if (unchanged(t, range)) holds(t.tell).add(range[0]);
  }
  for (const t of located) {
    if (!t.tracked || t.ranges.some((range) => unchanged(t, range))) continue;
    const free = occurrences(current, t.quote).find(([start]) => !holds(t.tell).has(start));
    if (free) {
      t.ranges.push(free);
      holds(t.tell).add(free[0]);
    }
  }

  return located.map(({ tell, quote, tracked, ranges }) => {
    const now = ranges.map(([start, end]) => current.slice(start, end));
    const changed = now.map((text) => !text.includes(quote));
    return { tell, tracked, ranges, now, changed, edited: tracked && changed.every(Boolean) };
  });
}

/**
 * The tells of each earlier Check that the player had worked on everywhere by the
 * next one, oldest first, so the list keeps them crossed off (spec B.58). `places`
 * gives the ranges a Check's tells were carried to in the next Check's text, where
 * the UI kept them; without them each quote is found by search.
 */
export function workedOnEarlier(
  checks: readonly CheckRecord[],
  places: (check: CheckRecord, text: string) => Range[][] | undefined = () => undefined,
): TrackedTell[] {
  return checks.slice(0, -1).flatMap((check, i) => {
    const next = checks[i + 1]!.text;
    const tells = check.outcome.score.tells ?? [];
    return trackTells(check.text, tells, next, places(check, next)).filter((t) => t.edited);
  });
}

/** Tells repeated on one phrase share its places; different tells on it each take them all. */
const key = (tell: Tell) => `${tell.label}\u0000${tell.quote}`;

/** Each tell's quote, found by search: the ranges a Check starts from. */
function placeTells(checked: string, tells: readonly Tell[], current: string): Range[][] {
  // The same tell repeated on one phrase (one per em dash, say) takes one place
  // each. Different tells on one phrase (Haiku's own and a measured one, spec B.45)
  // all mark it, so neither looks edited while the phrase is still there.
  const sharing = new Map<string, number>();
  for (const tell of tells)
    if (tell.quote) sharing.set(key(tell), (sharing.get(key(tell)) ?? 0) + 1);
  const seen = new Map<string, number>();

  return tells.map((tell) => {
    const tracked = !!tell.quote && checked.includes(tell.quote);
    let ranges = tracked ? occurrences(current, tell.quote!) : [];
    // Repeats take one place each, in order, and the last takes any spare; once
    // there are fewer places than repeats, the later ones count as edited.
    const shared = tell.quote ? sharing.get(key(tell))! : 1;
    if (tracked && shared > 1) {
      const nth = seen.get(key(tell)) ?? 0;
      seen.set(key(tell), nth + 1);
      ranges = nth === shared - 1 ? ranges.slice(nth) : ranges.slice(nth, nth + 1);
    }
    return ranges;
  });
}

function occurrences(text: string, quote: string): Range[] {
  const ranges: Range[] = [];
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + quote.length)) {
    ranges.push([at, at + quote.length]);
  }
  return ranges;
}

/** One change to the text: `removed` characters at `at` replaced by `inserted`. */
export type Edit = { at: number; removed: number; inserted: string };

/**
 * The single change that turned `before` into `after`, given where it left the
 * cursor and, if known, the selection it replaced.
 *
 * A selection typed or pasted over is the change, even where the new text
 * happens to match the old: pasting a whole passage over itself replaces all of
 * it. Otherwise it is the smallest change. Typing into a run of equal characters
 * could have happened anywhere in the run; the cursor, just after what was
 * typed, says where ("aab" -> "aaab" with the cursor at 2 is an insert at 1). A
 * change behind the cursor (a spell-check fix) is not widened up to it.
 */
export function findEdit(
  before: string,
  after: string,
  caret: number | null,
  selection: Range | null = null,
): Edit {
  if (selection) {
    const [start, end] = selection;
    const kept = before.length - end;
    if (
      end <= before.length &&
      after.length - kept >= start &&
      before.slice(0, start) === after.slice(0, start) &&
      before.slice(end) === after.slice(after.length - kept)
    ) {
      return { at: start, removed: end - start, inserted: after.slice(start, after.length - kept) };
    }
  }

  const shorter = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < shorter && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < shorter &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++;
  }

  let at = prefix;
  let kept = suffix;
  if (prefix + suffix >= shorter) {
    // A pure insert or delete, which may slide anywhere in [shorter - suffix, prefix].
    const typed = after.length - shorter;
    if (caret !== null) at = Math.min(prefix, Math.max(shorter - suffix, caret - typed));
    kept = shorter - at;
  }
  // Never split a surrogate pair (an emoji), so a range edge cannot land inside one.
  if (at > 0 && isHigh(before.charCodeAt(at - 1))) at--;
  if (kept > 0 && isLow(before.charCodeAt(before.length - kept))) kept--;

  return {
    at,
    removed: before.length - kept - at,
    inserted: after.slice(at, after.length - kept),
  };
}

const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * Carries each tell's ranges through an edit. Text typed inside a range, or
 * replacing part of it, becomes part of it. Text typed at its edge joins it only
 * while the player is still typing there (`typing`: the cursor has not moved since
 * the last edit) and has already changed it. So retyping a deleted phrase, or
 * typing over a selected one, keeps all the new text marked, while typing beside
 * an untouched phrase, or coming back later to one already worked on, never
 * spreads its highlight.
 */
export function moveRanges(tells: readonly TrackedTell[], edit: Edit, typing: boolean): Range[][] {
  const { at, removed, inserted } = edit;
  const end = at + removed;
  const shift = inserted.length - removed;
  return tells.map((t) =>
    t.ranges.map(([start, stop], j): Range => {
      const joins = typing && t.changed[j]!;
      if (at < stop && end > start) {
        return [Math.min(start, at), Math.max(stop + shift, at + inserted.length)];
      }
      if (at >= stop) return at === stop && joins ? [start, at + inserted.length] : [start, stop];
      return end === start && joins ? [at, stop + shift] : [start + shift, stop + shift];
    }),
  );
}

/** A run of text covered by the same tells (indices into the trackTells list). */
export type Segment = {
  start: number;
  text: string;
  tells: number[];
  /** Every range covering it has been worked on. */
  changed: boolean;
};

/** Splits the text at every range edge, so overlapping quotes each keep their own highlight. */
export function segments(text: string, tells: readonly TrackedTell[]): Segment[] {
  const edges = new Set([0, text.length]);
  for (const { ranges } of tells) {
    // An empty range (a deleted phrase) has nothing to draw, and its edge would
    // split one highlight into two.
    for (const [start, end] of ranges) if (start < end) edges.add(start).add(end);
  }
  const sorted = [...edges].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const [start, end] = [sorted[i]!, sorted[i + 1]!];
    const covering: number[] = [];
    let changed = true;
    tells.forEach((t, index) => {
      t.ranges.forEach(([s, e], j) => {
        if (s < e && s <= start && end <= e) {
          if (!covering.includes(index)) covering.push(index);
          if (!t.changed[j]) changed = false;
        }
      });
    });
    out.push({
      start,
      text: text.slice(start, end),
      tells: covering,
      changed: covering.length > 0 && changed,
    });
  }
  return out;
}

/**
 * The tell whose quote holds the cursor, ends included so a click just after a
 * phrase still counts. When quotes nest, the shortest wins: it is the more
 * specific tell. An empty range (a deleted phrase) holds the cursor at its place.
 */
export function tellAt(tells: readonly TrackedTell[], position: number): number | null {
  let best: number | null = null;
  let bestLength = Infinity;
  tells.forEach((t, index) => {
    for (const [start, end] of t.ranges) {
      if (start <= position && position <= end && end - start < bestLength) {
        best = index;
        bestLength = end - start;
      }
    }
  });
  return best;
}

/** Haiku's kebab-case labels as words ("stock-phrasing" -> "Stock phrasing"). Others are kept. */
export function tellLabel(label: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label)) return label;
  const words = label.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * How a Check shows on the score trail: at or under the goal with every guardrail
 * passed, blocked by a guardrail (meaning or grammar), or still over the goal.
 */
export function trailMark(check: CheckRecord, goal: number): "under" | "blocked" | "over" {
  if (check.outcome.guardrails.some((g) => !g.result.pass)) return "blocked";
  return check.outcome.score.score <= goal ? "under" : "over";
}

/** A score as the meter shows it: whole numbers plain, others to one decimal. */
export function formatScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** What the latest Check did, for the arcade effects (spec B.48). */
export type Hit = { kind: "better" | "worse" | "blocked"; text: string };

/**
 * What the latest Check did: blocked by a guardrail (local or remote), or the
 * score went down (better) or not (worse), with the change as arcade text. Null
 * before any Check, and for the free opening one.
 */
export function lastHit(checks: readonly CheckRecord[], outcome: CheckOutcome | null): Hit | null {
  if (!outcome) return null;
  if (!outcome.score) return { kind: "blocked", text: "BLOCKED" };
  const last = checks.at(-1);
  if (!last || last.opening) return null;
  if (outcome.guardrails.some((g) => !g.result.pass)) return { kind: "blocked", text: "BLOCKED" };
  const previous = checks.at(-2);
  const delta = previous
    ? Math.round((last.outcome.score.score - previous.outcome.score.score) * 10) / 10
    : 0;
  if (delta < 0) return { kind: "better", text: `-${formatScore(-delta)}` };
  return { kind: "worse", text: delta > 0 ? `+${formatScore(delta)}` : "+0" };
}

/** The headline after a Check, in NONSLOP's voice (spec B.53). */
export type Headline = { kind: "good" | "meh" | "error"; lines: string[] };

/** A drop of at least this much earns "NOT BAD, HUMAN"; a smaller one "NOT QUITE". */
const GOOD_DROP = 1.5;

/** NONSLOP's lines for a result that fell short, typed out like a terminal. */
const SHORT_LINES = [
  "ERROR: AI DETECTION TRIGGERED",
  "WARNING: HUMAN TEXT COEFFICIENT LOW",
  "SYSTEM FAILURE: CREATIVITY NOT FOUND",
  "CRITICAL: TOO PREDICTABLE",
];

/**
 * What the latest Check earns, as NONSLOP put it: "NOT BAD, HUMAN" for a good
 * drop, "NOT QUITE" for a small one, and error lines when the score did not drop
 * (two of its four, turning with each Check) or a guardrail blocked it (naming
 * the verdicts that failed). Null when lastHit is: before a Check, and for the
 * opening one.
 */
export function headlineFor(
  checks: readonly CheckRecord[],
  outcome: CheckOutcome | null,
): Headline | null {
  const hit = lastHit(checks, outcome);
  if (!hit || !outcome) return null;
  if (hit.kind === "blocked") {
    if (!outcome.score) return { kind: "error", lines: ["ERROR: CHECK REFUSED", "NO CHECK USED"] };
    const failed = outcome.guardrails.flatMap((g) =>
      !g.result.pass && g.result.verdict ? [`ERROR: ${g.result.verdict.toUpperCase()}`] : [],
    );
    return { kind: "error", lines: [...failed, "CRITICAL: ALL VERDICTS MUST PASS"] };
  }
  if (hit.kind === "better") {
    const [previous, last] = [checks.at(-2)!, checks.at(-1)!];
    const drop = previous.outcome.score.score - last.outcome.score.score;
    return drop >= GOOD_DROP
      ? { kind: "good", lines: ["NOT BAD, HUMAN"] }
      : { kind: "meh", lines: ["NOT QUITE"] };
  }
  const n = checks.length;
  return { kind: "error", lines: [SHORT_LINES[n % 4]!, SHORT_LINES[(n + 1) % 4]!] };
}

/** One note of the rhythm track: start and length in seconds, pitch in Hz. */
export type BeatNote = { start: number; length: number; frequency: number };

/** C major pentatonic, high to low: short sentences blip high, long ones hum low. */
const BEAT_SCALE = [1047, 880, 784, 659, 587, 523, 440, 392, 330, 294];

/**
 * The passage's sentences as notes (spec B.52): each held as long as the sentence
 * is long, and pitched lower the longer it is. Sentences of one length come out as
 * one note repeated, like a metronome; mixed lengths make a tune.
 */
export function beatNotes(lengths: readonly number[]): BeatNote[] {
  let start = 0;
  return lengths.map((words) => {
    const length = Math.min(1.4, Math.max(0.09, words * 0.035));
    const step = Math.min(BEAT_SCALE.length - 1, Math.max(0, Math.round((words - 3) / 4)));
    const note = { start, length, frequency: BEAT_SCALE[step]! };
    start += length + 0.07;
    return note;
  });
}
