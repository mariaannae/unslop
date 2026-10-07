/**
 * The game engine (spec §6, §9, §12–14): the domain types, the check sequence,
 * and the game store. Nothing in here may reference a provider, a task, or React;
 * which scorer and guardrails run is decided in config.ts.
 */

export type EvalContext = {
  original: string;
  current: string;
};

export type Tell = {
  label: string;
  quote?: string;
};

export type ScoreResult = {
  /** 0–10. 10 = strongly AI-like, 0 = strongly human-like, per the active scorer. */
  score: number;
  tells?: Tell[];
  /** Scorer-specific payload. Only remote guardrails may read it. */
  raw?: unknown;
};

export type GuardrailResult = {
  pass: boolean;
  reason?: string;
};

export type Passage = {
  id: string;
  text: string;
  topic?: string;
};

export interface Scorer {
  score(ctx: EvalContext): Promise<ScoreResult>;
}

export interface Guardrail {
  id: string;
  /** True when the check needs no network. Local guardrails run before the scorer. */
  local: boolean;
  check(ctx: EvalContext, score?: ScoreResult): Promise<GuardrailResult>;
}

/** Returns a random passage, avoiding `excludeId` whenever there is another choice. */
export type DrawPassage = (excludeId?: string) => Promise<Passage>;

/** A scorer the player can choose, with the win line on that scorer's own scale. */
export type ScorerOption = {
  id: string;
  /** Shown in the scorer menu. */
  label: string;
  scorer: Scorer;
  win: { scoreAtOrBelow: number };
};

export type GameConfig = {
  drawPassage: DrawPassage;
  /** The scorers the player can choose between, in menu order. */
  scorers: readonly ScorerOption[];
  /** Id of the scorer a new game starts with. The scripts score with it too. */
  defaultScorer: string;
  guardrails: readonly Guardrail[];
  budget: { checksPerPuzzle: number };
};

/** What one Check runs: a scorer and its win line, and the guardrails. */
export type CheckRules = {
  scorer: Scorer;
  guardrails: readonly Guardrail[];
  win: { scoreAtOrBelow: number };
};

/** The rules for a Check under the scorer with this id. Throws on an unknown id. */
export function checkRules(
  config: Pick<GameConfig, "scorers" | "guardrails">,
  scorerId: string,
): CheckRules {
  const option = config.scorers.find((s) => s.id === scorerId);
  if (!option) {
    const known = config.scorers.map((s) => s.id).join(", ");
    throw new Error(`Unknown scorer "${scorerId}". Known: ${known}`);
  }
  return { scorer: option.scorer, guardrails: config.guardrails, win: option.win };
}

export type CheckOutcome = {
  guardrails: Array<{ id: string; result: GuardrailResult }>;
  score?: ScoreResult;
  win: boolean;
  /** True when the scorer ran, which is the only thing that spends a Check (spec §13). */
  checkConsumed: boolean;
};

/**
 * The rule sequence for one Check:
 *   local guardrails -> scorer -> remote guardrails -> win decision.
 *
 * Pure with respect to its inputs. It never reads `ScoreResult.raw` and never
 * touches the budget; it only reports whether the scorer ran via `checkConsumed`.
 * Scorer errors propagate to the caller.
 */
export async function runCheck(ctx: EvalContext, rules: CheckRules): Promise<CheckOutcome> {
  const guardrails: CheckOutcome["guardrails"] = [];
  const allPassed = () => guardrails.every((entry) => entry.result.pass);

  for (const guardrail of rules.guardrails.filter((g) => g.local)) {
    guardrails.push({ id: guardrail.id, result: await guardrail.check(ctx) });
  }
  if (!allPassed()) {
    return { guardrails, win: false, checkConsumed: false };
  }

  const score = await rules.scorer.score(ctx);

  for (const guardrail of rules.guardrails.filter((g) => !g.local)) {
    guardrails.push({ id: guardrail.id, result: await guardrail.check(ctx, score) });
  }

  const win = allPassed() && score.score <= rules.win.scoreAtOrBelow;
  return { guardrails, score, win, checkConsumed: true };
}

export type GamePhase = "loading" | "playing" | "checking" | "won" | "lost";

export type GameState = {
  phase: GamePhase;
  passage: Passage | null;
  current: string;
  checksUsed: number;
  checksPerPuzzle: number;
  /** Id of the scorer the current puzzle is played under (GameConfig.scorers). */
  scorerId: string;
  outcome: CheckOutcome | null;
  /** Last scorer/provider failure. Cleared on the next edit, check, or new passage. */
  error: string | null;
};

/** The store the UI reads snapshots from and calls actions on. */
export interface Game {
  getState(): GameState;
  subscribe(listener: () => void): () => void;
  /** Draws a random passage (excluding the current one) and resets the puzzle. */
  newPassage(): Promise<void>;
  setCurrent(text: string): void;
  /** Runs a Check. Resolves to the outcome, or null if the check was refused or failed. */
  check(): Promise<CheckOutcome | null>;
  /**
   * Switches scorer. A puzzle is played under one scorer, so this restarts the
   * current passage: original text, full budget, no outcome. Ignored mid-check.
   */
  setScorer(id: string): void;
}

export function createGame(config: GameConfig): Game {
  checkRules(config, config.defaultScorer);
  let state: GameState = {
    phase: "loading",
    passage: null,
    current: "",
    checksUsed: 0,
    checksPerPuzzle: config.budget.checksPerPuzzle,
    scorerId: config.defaultScorer,
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
      const passage = await config.drawPassage(state.passage?.id);
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

      const rules = checkRules(config, state.scorerId);
      set({ phase: "checking", error: null });
      let outcome: CheckOutcome;
      try {
        outcome = await runCheck({ original: state.passage.text, current: state.current }, rules);
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

    setScorer(id) {
      if (state.phase === "checking" || id === state.scorerId) return;
      checkRules(config, id);
      // While a passage is loading there is nothing to restart; it arrives fresh.
      if (state.phase === "loading" || !state.passage) {
        set({ scorerId: id });
        return;
      }
      set({
        scorerId: id,
        phase: "playing",
        current: state.passage.text,
        checksUsed: 0,
        outcome: null,
        error: null,
      });
    },
  };
}
