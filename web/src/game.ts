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
  /**
   * A short verdict to show the player ("Meaning kept"), pass or fail. Set only
   * when the guardrail actually judged the text, so a check that was skipped (no
   * judge offline) shows nothing rather than a pass it never made (spec B.49).
   */
  verdict?: string;
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
  /**
   * Checks each puzzle's unedited passage as soon as it starts, so it opens with a
   * score and tells. Free: it spends no Check, and never wins or loses (spec B.45).
   */
  openingCheck?: boolean;
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

/**
 * Practice shows the scorer's tells; challenge hides them and shows only the
 * score. The engine plays both the same way: the mode only tells the UI what to
 * show, and like the scorer it is fixed for a puzzle (spec B.43).
 */
export type GameMode = "practice" | "challenge";

/** A scored Check: the text the scorer saw, and what came back. */
export type CheckRecord = {
  text: string;
  outcome: CheckOutcome & { score: ScoreResult };
  /** The free Check of the unedited passage a puzzle opens with (spec B.45). */
  opening?: boolean;
};

export type GameState = {
  phase: GamePhase;
  passage: Passage | null;
  current: string;
  checksUsed: number;
  checksPerPuzzle: number;
  /** Id of the scorer the current puzzle is played under (GameConfig.scorers). */
  scorerId: string;
  mode: GameMode;
  /** The latest Check's outcome, including one a local guardrail refused. */
  outcome: CheckOutcome | null;
  /** The opening Check, if any, then every Check this puzzle that spent one, oldest first. */
  checks: CheckRecord[];
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
  /** Switches mode, restarting the current passage the same way. Ignored mid-check. */
  setMode(mode: GameMode): void;
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
    mode: "practice",
    outcome: null,
    checks: [],
    error: null,
  };
  const listeners = new Set<() => void>();
  // Bumped whenever a puzzle starts. A Check that resolves after its puzzle was
  // replaced (a new passage, scorer or mode) is dropped rather than applied.
  let puzzle = 0;

  function set(patch: Partial<GameState>) {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  }

  /**
   * The opening Check (spec B.45): the whole pipeline on the unedited passage, so
   * the puzzle starts with the judge's score and tells. It spends nothing and
   * never ends the puzzle, whatever the score or the guardrails say.
   */
  async function open() {
    if (!config.openingCheck || !state.passage) return;
    const token = puzzle;
    const text = state.passage.text;
    set({ phase: "checking" });
    let outcome: CheckOutcome;
    try {
      outcome = await runCheck(
        { original: text, current: text },
        checkRules(config, state.scorerId),
      );
    } catch (error) {
      if (token !== puzzle) return;
      set({ phase: "playing", error: error instanceof Error ? error.message : String(error) });
      return;
    }
    if (token !== puzzle) return;
    if (!outcome.score) {
      set({ phase: "playing", outcome });
      return;
    }
    // The record shares the outcome object, so the UI can tell this one apart.
    const scored = { ...outcome, score: outcome.score };
    set({ phase: "playing", outcome: scored, checks: [{ text, outcome: scored, opening: true }] });
  }

  /**
   * Applies a rule change (scorer or mode). A puzzle is played under one set of
   * rules, so this restarts the current passage: original text, full budget, no
   * outcome. While a passage is loading there is nothing to restart.
   */
  function restart(patch: Pick<Partial<GameState>, "scorerId" | "mode">) {
    if (state.phase === "loading" || !state.passage) {
      set(patch);
      return;
    }
    puzzle++;
    set({
      ...patch,
      phase: "playing",
      current: state.passage.text,
      checksUsed: 0,
      outcome: null,
      checks: [],
      error: null,
    });
    void open();
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async newPassage() {
      const token = ++puzzle;
      set({ phase: "loading", error: null });
      const passage = await config.drawPassage(state.passage?.id);
      if (token !== puzzle) return;
      set({
        phase: "playing",
        passage,
        current: passage.text,
        checksUsed: 0,
        outcome: null,
        checks: [],
        error: null,
      });
      await open();
    },

    setCurrent(text) {
      if (state.phase !== "playing") return;
      set({ current: text, error: null });
    },

    async check() {
      if (state.phase !== "playing" || !state.passage) return null;
      if (state.checksUsed >= state.checksPerPuzzle) return null;

      const rules = checkRules(config, state.scorerId);
      const token = puzzle;
      set({ phase: "checking", error: null });
      let outcome: CheckOutcome;
      try {
        outcome = await runCheck({ original: state.passage.text, current: state.current }, rules);
      } catch (error) {
        if (token !== puzzle) return null;
        // A scorer/API failure costs nothing (spec §13) but must be surfaced, never swallowed.
        set({ phase: "playing", error: error instanceof Error ? error.message : String(error) });
        return null;
      }
      if (token !== puzzle) return null;

      const checksUsed = state.checksUsed + (outcome.checkConsumed ? 1 : 0);
      const phase: GamePhase = outcome.win
        ? "won"
        : checksUsed >= state.checksPerPuzzle
          ? "lost"
          : "playing";
      const checks = outcome.score
        ? [...state.checks, { text: state.current, outcome: { ...outcome, score: outcome.score } }]
        : state.checks;
      set({ phase, checksUsed, outcome, checks });
      return outcome;
    },

    setScorer(id) {
      if (state.phase === "checking" || id === state.scorerId) return;
      checkRules(config, id);
      restart({ scorerId: id });
    },

    setMode(mode) {
      if (state.phase === "checking" || mode === state.mode) return;
      restart({ mode });
    },
  };
}
