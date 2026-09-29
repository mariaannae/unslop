/**
 * The single authoritative game configuration (spec §7).
 * Implementations are selected by id; see core/registry.ts for the known ids.
 */
export type GameConfig = {
  passageSource: string;
  scorer: string;
  guardrails: readonly string[];
  /** Omit to run without a referee. "none" always approves. */
  referee?: string;
  win: {
    scoreAtOrBelow: number;
  };
  budget: {
    checksPerPuzzle: number;
  };
  guardrailParams: Readonly<Record<string, unknown>>;
};

export const gameConfig: GameConfig = {
  passageSource: "static-bank",

  // "llm-basic" scores through the Worker (run `pnpm dev:worker` alongside the app).
  // Switch to "mock" and drop "meaning-fluency" to play with no server at all.
  scorer: "llm-basic",

  guardrails: ["not-empty", "length-ratio", "meaning-fluency"],

  referee: "none",

  win: {
    scoreAtOrBelow: 2,
  },

  budget: {
    checksPerPuzzle: 6,
  },

  guardrailParams: {
    "length-ratio": {
      min: 0.7,
      max: 1.3,
    },
  },
};
