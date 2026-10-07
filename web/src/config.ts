import type { GenerationModel } from "../../scripts/generateV1";
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

  // scorers.jev and scorers.llmBasic score through the Worker (run `pnpm dev:worker`
  // alongside the app). scorers.mock plays offline with no server at all.
  scorer: scorers.jev,

  // Local guardrails run before the scorer and cost no Check; remote ones read its result.
  guardrails: [
    guardrails.notEmpty,
    guardrails.lengthRatio({ min: 0.7, max: 1.3 }),
    guardrails.meaning,
    guardrails.grammar,
  ],

  win: {
    scoreAtOrBelow: 2,
  },

  budget: {
    checksPerPuzzle: 6,
  },
};

/**
 * Model that `pnpm generate` writes the passage bank with. The prompt is the same
 * for every model; each option's provider and temperature are in
 * GENERATE_V1_MODELS (scripts/generateV1.ts). The game itself never reads this.
 * GPT models need OPENAI_API_KEY in worker/.dev.vars. Candidates are scored with
 * gameConfig's scorer, so its keys are needed too: ANTHROPIC_API_KEY, and
 * TYPESAFE_API_KEY for scorers.jev.
 *
 *   "claude-haiku-4-5"    smallest and fastest, temperature 0
 *   "claude-opus-4-6"     largest, previous generation, temperature 0
 *   "claude-opus-5"       previous Opus, default temperature, thinks first
 *   "claude-sonnet-5-5"   current Sonnet, default temperature, thinks first
 *   "claude-opus-5-5"     current Opus, default temperature, thinks first
 *   "gpt-3.5-turbo"       legacy, temperature 0; OpenAI shuts it down 2026-10-23
 *   "gpt-4"               legacy, temperature 0; OpenAI shuts it down 2026-10-23
 *   "gpt-4o"              temperature 0
 *   "gpt-5"               previous GPT-5, default temperature, thinks first
 *   "gpt-5.6-terra"       GPT-5.6, balanced, default temperature, thinks first
 *   "gpt-5.6-sol"         GPT-5.6 flagship, default temperature, thinks first
 */
export const generationModel: GenerationModel = "gpt-4o";
