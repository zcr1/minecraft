// @refresh reset
import { useEffect, useRef, useState } from "react";
import Game from "engine/Game";
import { setupScene } from "../game/setup";
import DebugMenu from "./DebugMenu";
import { GameProvider } from "./GameContext";

export default function GameCanvas() {
    const gameContainer = useRef<HTMLDivElement>(null);
    const [game, setGame] = useState<Game | null>(null);

    useEffect(() => {
        // ref is always set by mount time; null check required by TypeScript
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
