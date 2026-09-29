import type { Guardrail } from "../core/types";

export type LengthRatioParams = { min: number; max: number };

export const DEFAULT_LENGTH_RATIO: LengthRatioParams = { min: 0.7, max: 1.3 };

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function resolveParams(params: unknown): LengthRatioParams {
  const p = (params ?? {}) as Partial<LengthRatioParams>;
  const min = typeof p.min === "number" ? p.min : DEFAULT_LENGTH_RATIO.min;
  const max = typeof p.max === "number" ? p.max : DEFAULT_LENGTH_RATIO.max;
  if (!(min > 0) || !(max >= min)) {
    throw new Error(`length-ratio: invalid bounds min=${min} max=${max}`);
  }
  return { min, max };
}

/**
 * Local guardrail: current word count / original word count must fall inside
 * configurable bounds (spec §10.3). A cheap validity check, not a semantic one.
 */
export function createLengthRatioGuardrail(params: unknown): Guardrail {
  const { min, max } = resolveParams(params);
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
