import type {
  CheckOutcome,
  EvalContext,
  Guardrail,
  GuardrailResult,
  Referee,
  Scorer,
} from "./types";

export type PipelineDeps = {
  scorer: Scorer;
  guardrails: Guardrail[];
  /** Undefined means no referee is configured. */
  referee?: Referee;
  win: { scoreAtOrBelow: number };
};

export interface Pipeline {
  runCheck(ctx: EvalContext): Promise<CheckOutcome>;
}

/**
 * The game engine's rule sequence (spec §9):
 *   local guardrails -> scorer -> remote guardrails -> referee -> win decision.
 *
 * Pure with respect to its inputs and module outputs. It never reads
 * `ScoreResult.raw` and never touches the budget; it only reports whether the
 * scorer ran via `checkConsumed`. Scorer errors propagate to the caller.
 */
export function createPipeline(deps: PipelineDeps): Pipeline {
  const local = deps.guardrails.filter((g) => g.local);
  const remote = deps.guardrails.filter((g) => !g.local);

  return {
    async runCheck(ctx) {
      const guardrails: CheckOutcome["guardrails"] = [];

      for (const guardrail of local) {
        guardrails.push({ id: guardrail.id, result: await guardrail.check(ctx) });
      }
      if (!allPassed(guardrails)) {
        return { guardrails, win: false, checkConsumed: false };
      }

      const score = await deps.scorer.score(ctx);

      for (const guardrail of remote) {
        guardrails.push({ id: guardrail.id, result: await guardrail.check(ctx, score) });
      }

      const wouldWin = allPassed(guardrails) && score.score <= deps.win.scoreAtOrBelow;
      if (!wouldWin) {
        return { guardrails, score, win: false, checkConsumed: true };
      }

      if (!deps.referee) {
        return { guardrails, score, win: true, checkConsumed: true };
      }

      const referee = await deps.referee.verify(ctx, score);
      return { guardrails, score, referee, win: referee.approved, checkConsumed: true };
    },
  };
}

function allPassed(results: Array<{ result: GuardrailResult }>): boolean {
  return results.every((entry) => entry.result.pass);
}
