import type { ScoreV1Result } from "@unslop/shared";
import type { Scorer } from "../core/types";
import type { TaskClient } from "../providers/taskClient";

/**
 * First real scorer (spec §15): one `score-v1` task call. Score and tells are
 * returned as game values; the full task result rides along in `raw` for
 * remote guardrails (see guardrails/meaningFluency.ts). Errors propagate so the
 * game state can report them without spending a Check.
 */
export const LLM_BASIC_TASK_ID = "score-v1";

export function createLlmBasicScorer(client: TaskClient): Scorer {
  return {
    id: "llm-basic",
    async score(ctx) {
      const { result } = await client.run<ScoreV1Result>(LLM_BASIC_TASK_ID, {
        original: ctx.original,
        current: ctx.current,
      });
      return { score: result.score, tells: result.tells, raw: result };
    },
  };
}
