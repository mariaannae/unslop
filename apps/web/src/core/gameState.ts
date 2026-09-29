import type { GameConfig } from "../config/game.config";
import { createPipeline, type Pipeline } from "./pipeline";
import type { Registry } from "./registry";
import type { CheckOutcome, Passage, PassageSource } from "./types";

/**
 * Core game state (spec §12–14): owns the passage, the edit, the Check budget,
 * and the last outcome. The UI only reads snapshots and calls the actions.
 */

export type GamePhase = "loading" | "playing" | "checking" | "won" | "lost";

export type GameState = {
  phase: GamePhase;
  passage: Passage | null;
  current: string;
  checksUsed: number;
  checksPerPuzzle: number;
  outcome: CheckOutcome | null;
  /** Last scorer/provider failure. Cleared on the next edit, check, or new passage. */
  error: string | null;
};

export interface Game {
  getState(): GameState;
  subscribe(listener: () => void): () => void;
  /** Draws a random passage (excluding the current one) and resets the puzzle. */
  newPassage(): Promise<void>;
  setCurrent(text: string): void;
  /** Runs the pipeline. Resolves to the outcome, or null if the check was refused or failed. */
  check(): Promise<CheckOutcome | null>;
}

export type GameDeps = {
  pipeline: Pipeline;
  passageSource: PassageSource;
  checksPerPuzzle: number;
};

export function createGame(deps: GameDeps): Game {
  let state: GameState = {
    phase: "loading",
    passage: null,
    current: "",
    checksUsed: 0,
    checksPerPuzzle: deps.checksPerPuzzle,
    outcome: null,
    error: null,
  };
  const listeners = new Set<() => void>();

  function set(patch: Partial<GameState>) {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async newPassage() {
      set({ phase: "loading", error: null });
      const passage = await deps.passageSource.getRandom(state.passage?.id);
      set({
        phase: "playing",
        passage,
        current: passage.text,
        checksUsed: 0,
        outcome: null,
        error: null,
      });
    },

    setCurrent(text) {
      if (state.phase !== "playing") return;
      set({ current: text, error: null });
    },

    async check() {
      if (state.phase !== "playing" || !state.passage) return null;
      if (state.checksUsed >= state.checksPerPuzzle) return null;

      set({ phase: "checking", error: null });
      let outcome: CheckOutcome;
      try {
        outcome = await deps.pipeline.runCheck({
          puzzleId: state.passage.id,
          original: state.passage.text,
          current: state.current,
          checksUsed: state.checksUsed,
        });
      } catch (error) {
        // A scorer/API failure costs nothing (spec §13) but must be surfaced, never swallowed.
        set({ phase: "playing", error: error instanceof Error ? error.message : String(error) });
        return null;
      }

      const checksUsed = state.checksUsed + (outcome.checkConsumed ? 1 : 0);
      const phase: GamePhase = outcome.win
        ? "won"
        : checksUsed >= state.checksPerPuzzle
          ? "lost"
          : "playing";
      set({ phase, checksUsed, outcome });
      return outcome;
    },
  };
}

/** Wires config + registry into a playable game. The only place ids are resolved. */
export function createGameFromConfig(config: GameConfig, registry: Registry): Game {
  const pipeline = createPipeline({
    scorer: registry.getScorer(config.scorer),
    guardrails: registry.getGuardrails(config.guardrails, config.guardrailParams),
    referee: config.referee === undefined ? undefined : registry.getReferee(config.referee),
    win: config.win,
  });
  return createGame({
    pipeline,
    passageSource: registry.getPassageSource(config.passageSource),
    checksPerPuzzle: config.budget.checksPerPuzzle,
  });
}
