import { useEffect, useRef, useState } from "react";
import type { Game } from "../core/gameState";
import { OutcomePanel } from "./OutcomePanel";
import { PassageEditor } from "./PassageEditor";
import { useGameState } from "./useGame";

type Props = { game: Game };

/**
 * Single-column, mobile-first layout. The action bar is `sticky` inside the
 * flex column rather than `fixed`, so iOS keeps it attached to the content
 * when the keyboard opens instead of floating it mid-screen.
 */
export function GameView({ game }: Props) {
  const state = useGameState(game);
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
