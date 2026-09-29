import type { GamePhase } from "../core/gameState";
import type { CheckOutcome } from "../core/types";
import { ScoreMeter } from "./ScoreMeter";

type Props = {
  phase: GamePhase;
  outcome: CheckOutcome | null;
  error: string | null;
};

/** Renders whatever the core reported: guardrail feedback, score, tells, and win/loss. */
export function OutcomePanel({ phase, outcome, error }: Props) {
  if (error) {
    return (
      <section
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
      >
        <p className="font-semibold">Check failed, no check used.</p>
        <p>{error}</p>
      </section>
    );
  }

  if (!outcome) return null;

  const failed = outcome.guardrails.filter((g) => !g.result.pass);
  const tells = outcome.score?.tells ?? [];

  return (
    <section aria-live="polite" className="flex flex-col gap-3">
      {phase === "won" ? (
        <p className="rounded-md bg-green-100 p-3 text-base font-semibold text-green-900">
          You did it. The judge no longer thinks this reads as AI.
        </p>
      ) : phase === "lost" ? (
        <p className="rounded-md bg-neutral-200 p-3 text-base font-semibold text-neutral-900">
          Out of checks. Try a new passage.
        </p>
      ) : null}

      {failed.length > 0 ? (
        <ul className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {failed.map((g) => (
            <li key={g.id}>{g.result.reason ?? `Blocked by ${g.id}.`}</li>
          ))}
        </ul>
      ) : null}

      {outcome.score ? <ScoreMeter score={outcome.score.score} /> : null}

      {outcome.referee && !outcome.referee.approved ? (
        <ul className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {outcome.referee.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {tells.length > 0 ? (
        <div className="text-sm">
          <p className="mb-1 font-semibold">Tells</p>
          <ul className="flex flex-col gap-1">
            {tells.map((tell, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                <span className="rounded bg-neutral-200 px-1.5 text-xs leading-5 text-neutral-700">
                  {tell.label}
                </span>
                <q className="text-neutral-800">{tell.quote}</q>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
