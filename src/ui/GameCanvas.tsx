// @refresh reset
import Game from "engine/Game";
import { useEffect, useRef } from "react";
import { setupScene } from "../game/setup";
import DebugMenu from "./DebugMenu";
import type DebugCameraController from "engine/debug/DebugCameraController";
import type PlayerCamera from "engine/player/PlayerCamera";

export default function GameCanvas() {
    const mountRef = useRef<HTMLDivElement>(null);
    const playerCameraRef = useRef<PlayerCamera | null>(null);
    const debugCameraRef = useRef<DebugCameraController | null>(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const game = new Game(mount);
        const { playerCamera, debugCameraController } = setupScene(game);
        playerCameraRef.current = playerCamera;
        debugCameraRef.current = debugCameraController;
        game.start();

        return () => game.stop();
    }, []);

    return (
        <>
            <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />
            <DebugMenu playerCamera={playerCameraRef} debugCamera={debugCameraRef} />
        </>
    );
}
