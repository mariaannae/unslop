import type { Guardrail } from "./game";

/** Local: the current text must contain something other than whitespace (spec §10.2). */
export const notEmpty: Guardrail = {
  id: "not-empty",
  local: true,
  async check(ctx) {
    if (ctx.current.trim().length > 0) return { pass: true };
    return { pass: false, reason: "The passage is empty." };
  },
};

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Local: current word count / original word count must fall inside [min, max]
 * (spec §10.3). A cheap validity check, not a semantic one.
 */
export function lengthRatio({ min, max }: { min: number; max: number }): Guardrail {
  if (!(min > 0) || !(max >= min)) {
    throw new Error(`length-ratio: invalid bounds min=${min} max=${max}`);
  }
  return {
    id: "length-ratio",
    local: true,
    async check(ctx) {
      const originalWords = countWords(ctx.original);
      const currentWords = countWords(ctx.current);
      if (originalWords === 0) return { pass: true };
      const ratio = currentWords / originalWords;
      if (ratio < min) {
        return {
          pass: false,
          reason: `Too short: ${currentWords} words, needs at least ${Math.ceil(originalWords * min)}.`,
        };
      }
      if (ratio > max) {
        return {
          pass: false,
          reason: `Too long: ${currentWords} words, needs at most ${Math.floor(originalWords * max)}.`,
        };
      }
      return { pass: true };
    },
  };
}

export const MEANING_CHANGED_REASON = "The judge thinks the meaning changed.";
export const NOT_FLUENT_REASON = "The judge thinks this isn't fluent English.";

/**
 * Remote (spec §23): reads `meaning_preserved` and `fluent` from the scorer's
 * raw payload, so it costs no extra call. It only fails on an explicit `false`;
 * if the payload is missing either field, it passes and the judgement rests on
 * the score alone. That also makes it harmless with the mock scorer.
 */
export const meaningFluency: Guardrail = {
  id: "meaning-fluency",
  local: false,
  async check(_ctx, score) {
    const raw = (score?.raw ?? {}) as { meaning_preserved?: unknown; fluent?: unknown };
    if (raw.meaning_preserved === false) return { pass: false, reason: MEANING_CHANGED_REASON };
    if (raw.fluent === false) return { pass: false, reason: NOT_FLUENT_REASON };
    return { pass: true };
  },
};
