// @refresh reset
import { useState, useEffect, useRef } from "react";
import Game from "engine/Game";
import { setupScene } from "../game/setup";
import { GameProvider } from "./GameContext";
import DebugMenu from "./DebugMenu";

export default function GameCanvas() {
    const gameContainer = useRef<HTMLDivElement>(null);
    const [game, setGame] = useState<Game | null>(null);

    useEffect(() => {
        // Gratuitous but satisfies ts
        const mount = gameContainer.current;
        if (!mount) {
            return;
        }

        const game = new Game(mount);
        setupScene(game);
        game.start();
        setGame(game);

        return () => game.stop();
    }, []);

    return (
        <GameProvider value={game}>
            <div ref={gameContainer} style={{ width: "100vw", height: "100vh" }} />
            {game && <DebugMenu />}
        </GameProvider>
    );
}
