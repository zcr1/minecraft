// @refresh reset
import { useEffect, useRef, useState } from "react";
import game from "engine/Game";
import { setupScene } from "../game/setup";
import Crosshair from "./Crosshair";
import DebugMenu from "./DebugMenu";
import { GameProvider } from "./GameContext";
import InventoryHUD from "./InventoryHUD";
import UnderwaterOverlay from "./UnderwaterOverlay";

export default function GameCanvas() {
    const gameContainer = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // ref is always set by mount time; null check required by TypeScript
        const mount = gameContainer.current;
        if (!mount) {
            return;
        }

        game.init(mount);
        setupScene();
        game.start();
        setReady(true);

        return () => game.stop();
    }, []);

    return (
        <GameProvider value={ready ? game : null}>
            <div ref={gameContainer} style={{ width: "100vw", height: "100vh" }} />
            {ready && (
                <>
                    <DebugMenu />
                    <InventoryHUD />
                    <Crosshair />
                    <UnderwaterOverlay />
                </>
            )}
        </GameProvider>
    );
}
