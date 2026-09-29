import type { Guardrail } from "../core/types";

/** Local guardrail: the current text must contain something other than whitespace (spec §10.2). */
export const notEmptyGuardrail: Guardrail = {
  id: "not-empty",
  local: true,
  async check(ctx) {
    if (ctx.current.trim().length > 0) return { pass: true };
    return { pass: false, reason: "The passage is empty." };
  },
};
