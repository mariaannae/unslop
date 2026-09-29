import type { Guardrail } from "../core/types";

/**
 * Remote guardrail (spec §23): reads `meaning_preserved` and `fluent` from the
 * scorer's raw payload, so it costs no extra call. It only fails on an explicit
 * `false`; if the payload is missing either field, the guardrail passes and the
 * judgement rests on the score alone.
 */
export const MEANING_CHANGED_REASON = "The judge thinks the meaning changed.";
export const NOT_FLUENT_REASON = "The judge thinks this isn't fluent English.";

export const meaningFluencyGuardrail: Guardrail = {
  id: "meaning-fluency",
  local: false,
  async check(_ctx, score) {
    const raw = (score?.raw ?? {}) as { meaning_preserved?: unknown; fluent?: unknown };
    if (raw.meaning_preserved === false) return { pass: false, reason: MEANING_CHANGED_REASON };
    if (raw.fluent === false) return { pass: false, reason: NOT_FLUENT_REASON };
    return { pass: true };
  },
};
