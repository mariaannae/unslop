import type { GameConfig } from "./game";
import * as guardrails from "./guardrails";
import { createStaticBank } from "./passages";
import * as scorers from "./scorers";

/**
 * The game's settings (spec §7). To try a different scorer or guardrail, change
 * a line here; the engine (game.ts) and the UI never name a specific one.
 */
export const gameConfig: GameConfig = {
  drawPassage: createStaticBank(),

  // scorers.llmBasic scores through the Worker (run `pnpm dev:worker` alongside the app).
  // scorers.mock plays offline with no server at all.
  scorer: scorers.llmBasic,

  // Local guardrails run before the scorer and cost no Check; remote ones read its result.
  guardrails: [
    guardrails.notEmpty,
    guardrails.lengthRatio({ min: 0.7, max: 1.3 }),
    guardrails.meaningFluency,
  ],

  win: {
    scoreAtOrBelow: 2,
  },

  budget: {
    checksPerPuzzle: 6,
  },
};
