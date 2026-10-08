import type { JudgeJevResult } from "../../shared/judgeJev";
import type { EvalContext, Guardrail } from "./game";
import { runRemoteTask } from "./scorers";

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
 * (spec §10.3). A cheap validity check, not a semantic one. Blank text passes,
 * because not-empty already reports it.
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
      if (originalWords === 0 || currentWords === 0) return { pass: true };
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
export const NOT_GRAMMATICAL_REASON = "The judge thinks this isn't grammatically correct.";

/**
 * Remote (spec §23): reads one of the judge's verdicts from the scorer's raw
 * payload, so it costs no extra call. It only fails on an explicit `false`; if
 * the payload is missing the field, it passes and the judgement rests on the
 * score alone. That also makes it harmless with the mock scorer. Only
 * scorers.llmBasic carries Haiku's verdicts since spec B.42, so with any other
 * scorer these two check nothing.
 */
function judgeVerdict(id: string, field: string, reason: string): Guardrail {
  return {
    id,
    local: false,
    async check(_ctx, score) {
      const raw = (score?.raw ?? {}) as Record<string, unknown>;
      if (raw[field] === false) return { pass: false, reason };
      return { pass: true };
    },
  };
}

export const meaning = judgeVerdict("meaning", "meaning_preserved", MEANING_CHANGED_REASON);
export const grammar = judgeVerdict("grammar", "grammatically_correct", NOT_GRAMMATICAL_REASON);

/**
 * Remote: the same two verdicts from TypeSafe's Jev (`judge-jev`, spec B.41,
 * B.42), the game's default. They make their own call, one per Check however
 * many of them run, and fail only when Jev says no. After a scorer that made no
 * server call (no `raw`, as with the mock) they pass without asking, so offline
 * play still needs no server.
 */
const jevVerdicts = new WeakMap<EvalContext, Promise<JudgeJevResult>>();

function jevVerdict(
  id: string,
  field: "meaning_preserved" | "grammatically_correct",
  reason: string,
): Guardrail {
  return {
    id,
    local: false,
    async check(ctx, score) {
      if (score?.raw === undefined) return { pass: true };
      let verdicts = jevVerdicts.get(ctx);
      if (!verdicts) {
        verdicts = runRemoteTask<JudgeJevResult>("judge-jev", {
          original: ctx.original,
          current: ctx.current,
        });
        jevVerdicts.set(ctx, verdicts);
      }
      if ((await verdicts)[field] === false) return { pass: false, reason };
      return { pass: true };
    },
  };
}

export const jevMeaning = jevVerdict("meaning-jev", "meaning_preserved", MEANING_CHANGED_REASON);
export const jevGrammar = jevVerdict(
  "grammar-jev",
  "grammatically_correct",
  NOT_GRAMMATICAL_REASON,
);
