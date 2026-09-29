import type { Scorer, Tell } from "../core/types";

/**
 * Deterministic offline scorer (spec §10.1).
 *
 * Counts occurrences of a small set of stock AI-prose markers and scores two
 * points per hit, capped at 10, reporting each hit as a tell. This lets the
 * full loop be played without a network: delete the markers and the score
 * falls. It is not a real detector and is not meant to be one.
 */
const MARKERS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "em-dash", pattern: /—/g },
  { label: "not-x-but-y", pattern: /\b(?:it'?s|this is|that'?s) not (?:just|only|about)\b/gi },
  {
    label: "importance-opener",
    pattern: /\bin today'?s (?:fast-paced|digital|modern|ever-changing) world\b/gi,
  },
  {
    label: "stock-word",
    pattern:
      /\b(?:delve|tapestry|testament|pivotal|seamless(?:ly)?|multifaceted|leverage|realm|embark|underscores?|crucial|robust|landscape|navigate|foster)\b/gi,
  },
  {
    label: "vague-authority",
    pattern: /\b(?:experts|studies|research) (?:agree|show|suggest)s?\b/gi,
  },
  { label: "summary-closer", pattern: /\b(?:ultimately|in conclusion|at the end of the day)\b/gi },
];

export function mockScore(text: string): { score: number; tells: Tell[] } {
  const tells: Tell[] = [];
  for (const { label, pattern } of MARKERS) {
    for (const match of text.matchAll(pattern)) {
      tells.push({ label, quote: match[0] });
    }
  }
  return { score: Math.min(10, tells.length * 2), tells };
}

export const mockScorer: Scorer = {
  id: "mock",
  async score(ctx) {
    return mockScore(ctx.current);
  },
};
