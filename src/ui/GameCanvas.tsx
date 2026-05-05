// @refresh reset
import Game from "engine/Game";
import { useEffect, useRef } from "react";
import { setupScene } from "../game/setup";

export default function GameCanvas() {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const game = new Game(mount);
        setupScene(game);
        game.start();

        return () => game.stop();
    }, []);

    return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}
