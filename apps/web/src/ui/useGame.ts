import { useSyncExternalStore } from "react";
import type { Game, GameState } from "../core/gameState";

/** Subscribes a component to the core game store. */
export function useGameState(game: Game): GameState {
  return useSyncExternalStore(game.subscribe, game.getState, game.getState);
}
