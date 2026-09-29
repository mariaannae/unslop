import { useEffect, useMemo } from "react";
import { gameConfig } from "../config/game.config";
import { registry } from "../config/registry";
import { createGameFromConfig } from "../core/gameState";
import { GameView } from "./GameView";

/** Composition root: builds the game from config once and hands it to the view. */
export function App() {
  const game = useMemo(() => createGameFromConfig(gameConfig, registry), []);

  useEffect(() => {
    if (game.getState().phase === "loading" && game.getState().passage === null) {
      void game.newPassage();
    }
  }, [game]);

  return <GameView game={game} />;
}
