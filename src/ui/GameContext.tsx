import { createContext, useContext } from "react";
import type game from "engine/Game";

type Game = typeof game;

const GameContext = createContext<Game | null>(null);

export const GameProvider = GameContext.Provider;

export function useGame(): Game {
    const game = useContext(GameContext);

    if (!game) {
        throw new Error("useGame must be used inside GameProvider");
    }

    return game;
}
