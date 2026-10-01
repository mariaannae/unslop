import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { gameConfig } from "./config";
import { createGame, type CheckOutcome, type GamePhase } from "./game";

/**
 * The whole screen. Builds the game from config once, subscribes to its store,
 * and renders it.
 *
 * Single-column, mobile-first layout. The action bar is `sticky` inside the
 * flex column rather than `fixed`, so iOS keeps it attached to the content
 * when the keyboard opens instead of floating it mid-screen.
 */
export function App() {
  const game = useMemo(() => createGame(gameConfig), []);
  const state = useSyncExternalStore(game.subscribe, game.getState, game.getState);
  const [showOriginal, setShowOriginal] = useState(false);
  const outcomeRef = useRef<HTMLDivElement>(null);

  const checksLeft = state.checksPerPuzzle - state.checksUsed;
  const loading = state.phase === "loading";
  const checking = state.phase === "checking";
  const canCheck = state.phase === "playing" && checksLeft > 0;
  const editable = state.phase === "playing";
  const over = state.phase === "won" || state.phase === "lost";
  const edited = state.passage !== null && state.current !== state.passage.text;

  useEffect(() => {
    if (game.getState().phase === "loading" && game.getState().passage === null) {
      void game.newPassage();
    }
  }, [game]);

  useEffect(() => {
    if (state.outcome || state.error) {
      outcomeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [state.outcome, state.error]);

  function onNewPassage() {
    const discarding = state.phase === "playing" && edited && state.checksUsed > 0;
    if (discarding && !window.confirm("Discard this puzzle and draw a new passage?")) return;
    void game.newPassage();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-white font-sans text-neutral-900">
      <header className="flex items-baseline justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-xl font-semibold tracking-tight">De-AI</h1>
        <p className="text-sm text-neutral-600" aria-live="polite">
          Checks left: <span className="font-semibold text-neutral-900">{checksLeft}</span> /{" "}
          {state.checksPerPuzzle}
        </p>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 pb-6">
        <p className="text-sm text-neutral-600">
          Edit this passage until it no longer reads like an AI wrote it. Keep the meaning.
          {state.passage?.topic ? (
            <>
              {" "}
              Topic: <span className="italic">{state.passage.topic}</span>.
            </>
          ) : null}
        </p>

        {loading ? (
          <div
            role="status"
            className="min-h-56 animate-pulse rounded-md border border-neutral-200 bg-neutral-100 p-3 text-sm text-neutral-500"
          >
            Loading passage…
          </div>
        ) : (
          <PassageEditor
            value={state.current}
            disabled={!editable}
            onChange={(text) => game.setCurrent(text)}
          />
        )}

        {state.passage ? (
          <details
            className="text-sm"
            open={showOriginal}
            onToggle={(e) => setShowOriginal(e.currentTarget.open)}
          >
            <summary className="cursor-pointer select-none py-2 text-neutral-600">
              {showOriginal ? "Hide original" : "Show original"}
            </summary>
            <blockquote className="mt-1 rounded-md border border-neutral-200 bg-neutral-50 p-3 font-serif leading-relaxed text-neutral-700">
              {state.passage.text}
            </blockquote>
          </details>
        ) : null}

        <div ref={outcomeRef} className="scroll-mt-4">
          <OutcomePanel phase={state.phase} outcome={state.outcome} error={state.error} />
        </div>
      </main>

      <footer className="sticky bottom-0 border-t border-neutral-200 bg-white/95 backdrop-blur">
        <div className="flex gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => void game.check()}
            disabled={!canCheck || checking}
            aria-busy={checking}
            className="min-h-12 flex-1 rounded-lg bg-neutral-900 px-4 py-3 text-base font-semibold text-white active:bg-neutral-700 disabled:bg-neutral-300"
          >
            {checking ? "Checking…" : "Check"}
          </button>
          <button
            type="button"
            onClick={onNewPassage}
            disabled={loading || checking}
            className={
              "min-h-12 rounded-lg border px-4 py-3 text-base font-semibold disabled:opacity-50 " +
              (over
                ? "flex-1 border-neutral-900 bg-neutral-900 text-white active:bg-neutral-700"
                : "border-neutral-300 bg-white text-neutral-900 active:bg-neutral-100")
            }
          >
            New passage
          </button>
        </div>
      </footer>
    </div>
  );
}

/** A plain textarea, per spec §4. Swap this component for a richer editor later. */
function PassageEditor(props: { value: string; disabled: boolean; onChange(text: string): void }) {
  return (
    <textarea
      value={props.value}
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.target.value)}
      aria-label="Passage"
      rows={10}
      spellCheck
      autoCapitalize="sentences"
      className="min-h-56 w-full resize-y rounded-md border border-neutral-300 bg-white p-3 font-serif text-base leading-relaxed text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-500"
    />
  );
}

/** Renders whatever the engine reported: guardrail feedback, score, tells, and win/loss. */
function OutcomePanel(props: {
  phase: GamePhase;
  outcome: CheckOutcome | null;
  error: string | null;
}) {
  const { phase, outcome, error } = props;
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

const MAX_SCORE = 10;

/** 0–10 meter. Presentation only; the win threshold lives in config, not here. */
function ScoreMeter({ score }: { score: number }) {
  const pct = Math.round((Math.max(0, Math.min(MAX_SCORE, score)) / MAX_SCORE) * 100);
  return (
    <div className="text-sm">
      <div className="mb-1 flex justify-between">
        <span className="font-semibold">AI-likeness</span>
        <span>
          {score} / {MAX_SCORE}
        </span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={MAX_SCORE}
        aria-valuenow={score}
        className="h-3 w-full overflow-hidden rounded-full bg-neutral-200"
      >
        <div className="h-full bg-neutral-900 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-neutral-500">
        <span>human</span>
        <span>AI</span>
      </div>
    </div>
  );
}
