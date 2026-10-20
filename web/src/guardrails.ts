import type { JudgeJevResult } from "../../shared/judgeJev";
import type { EvalContext, Guardrail, GuardrailResult } from "./game";
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

/** What the player is shown for each verdict, pass and fail (spec B.49). */
type Verdicts = { pass: string; fail: string };
const MEANING: Verdicts = { pass: "Meaning kept", fail: "Meaning changed" };
const GRAMMAR: Verdicts = { pass: "Grammar correct", fail: "Grammar not correct" };

/** A judge's yes or no as a result; no answer passes with no verdict. */
function verdictResult(answer: unknown, reason: string, verdicts: Verdicts): GuardrailResult {
  if (answer === false) return { pass: false, reason, verdict: verdicts.fail };
  if (answer === true) return { pass: true, verdict: verdicts.pass };
  return { pass: true };
}

/**
 * Remote (spec §23): reads one of the judge's verdicts from the scorer's raw
 * payload, so it costs no extra call. It only fails on an explicit `false`; if
 * the payload is missing the field, it passes and the judgement rests on the
 * score alone. That also makes it harmless with the mock scorer. Only
 * scorers.llmBasic carries Haiku's grammar verdict since spec B.42, so with any
 * other scorer it checks nothing. Haiku's meaning verdict went in spec B.51: it
 * never sees the original, so meaning comes from Jev alone.
 */
function judgeVerdict(id: string, field: string, reason: string, verdicts: Verdicts): Guardrail {
  return {
    id,
    local: false,
    async check(_ctx, score) {
      const raw = (score?.raw ?? {}) as Record<string, unknown>;
      return verdictResult(raw[field], reason, verdicts);
    },
  };
}

export const grammar = judgeVerdict(
  "grammar",
  "grammatically_correct",
  NOT_GRAMMATICAL_REASON,
  GRAMMAR,
);

/**
 * Remote: the same two verdicts from TypeSafe's Jev (`judge-jev`, spec B.41,
 * B.42), the game's default. They make their own call, one per Check however
 * many of them run, and fail only when Jev says no. After a scorer that made no
 * server call (no `raw`, as with the mock) they pass without asking, so offline
 * play still needs no server.
 */
const jevAnswers = new WeakMap<EvalContext, Promise<JudgeJevResult>>();

function jevVerdict(
  id: string,
  field: "meaning_preserved" | "grammatically_correct",
  reason: string,
  verdicts: Verdicts,
): Guardrail {
  return {
    id,
    local: false,
    async check(ctx, score) {
      if (score?.raw === undefined) return { pass: true };
      let answers = jevAnswers.get(ctx);
      if (!answers) {
        answers = runRemoteTask<JudgeJevResult>("judge-jev", {
          original: ctx.original,
          current: ctx.current,
        });
        jevAnswers.set(ctx, answers);
      }
      return verdictResult((await answers)[field], reason, verdicts);
    },
  };
}

export const jevMeaning = jevVerdict(
  "meaning-jev",
  "meaning_preserved",
  MEANING_CHANGED_REASON,
  MEANING,
);
export const jevGrammar = jevVerdict(
  "grammar-jev",
  "grammatically_correct",
  NOT_GRAMMATICAL_REASON,
  GRAMMAR,
);
