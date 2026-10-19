import type { Tell } from "./game";

/**
 * Presentation helpers for the feedback the UI draws between Checks (spec B.43):
 * where the last Check's tells sit in the text being edited now. Nothing here
 * decides a win; that stays in the engine.
 */

/** A tell from the last Check, located in the current text. */
export type TrackedTell = {
  tell: Tell;
  /**
   * Whether its quote was in the text that was checked. Only these are
   * highlighted or crossed off: a quote that never matched (Jev's stock-vocabulary
   * list, say) cannot tell us anything about an edit.
   */
  tracked: boolean;
  /** Every [start, end) where the quote appears in the current text. */
  ranges: Array<[number, number]>;
  /** Tracked, but the quote is gone: the player has edited it. Only the next Check says if that helped. */
  edited: boolean;
};

export function trackTells(
  checked: string,
  tells: readonly Tell[],
  current: string,
): TrackedTell[] {
  const sharing = new Map<string, number>();
  for (const { quote } of tells) if (quote) sharing.set(quote, (sharing.get(quote) ?? 0) + 1);
  const seen = new Map<string, number>();

  return tells.map((tell) => {
    const tracked = !!tell.quote && checked.includes(tell.quote);
    let ranges = tracked ? occurrences(current, tell.quote!) : [];
    // Tells with the same quote (one per em dash, say) take one place each, in
    // order, and the last takes any spare; once there are fewer places than
    // tells, the later ones count as edited.
    const shared = tell.quote ? sharing.get(tell.quote)! : 1;
    if (tracked && shared > 1) {
      const nth = seen.get(tell.quote!) ?? 0;
      seen.set(tell.quote!, nth + 1);
      ranges = nth === shared - 1 ? ranges.slice(nth) : ranges.slice(nth, nth + 1);
    }
    return { tell, tracked, ranges, edited: tracked && ranges.length === 0 };
  });
}

function occurrences(text: string, quote: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + quote.length)) {
    ranges.push([at, at + quote.length]);
  }
  return ranges;
}

/** A run of text covered by the same tells (indices into the trackTells list). */
export type Segment = { start: number; text: string; tells: number[] };

/** Splits the text at every range edge, so overlapping quotes each keep their own highlight. */
export function segments(text: string, tells: readonly TrackedTell[]): Segment[] {
  const edges = new Set([0, text.length]);
  for (const { ranges } of tells) {
    for (const [start, end] of ranges) edges.add(start).add(end);
  }
  const sorted = [...edges].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const [start, end] = [sorted[i]!, sorted[i + 1]!];
    const covering = tells.flatMap((t, index) =>
      t.ranges.some(([s, e]) => s <= start && end <= e) ? [index] : [],
    );
    out.push({ start, text: text.slice(start, end), tells: covering });
  }
  return out;
}

/**
 * The tell whose quote holds the cursor, ends included so a click just after a
 * phrase still counts. When quotes nest, the shortest wins: it is the more
 * specific tell.
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
