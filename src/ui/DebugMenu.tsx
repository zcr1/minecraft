import { Pane } from "tweakpane";
import { useEffect, useRef, useState } from "react";
import DebugCameraController from "engine/debug/DebugCameraController";
import PlayerCamera from "engine/player/PlayerCamera";
import PlayerController from "engine/player/PlayerController";
import GameObjectName from "engine/utils/gameObjectNames";
import { useGame } from "./GameContext";

export default function DebugMenu() {
    const game = useGame();
    const [showFpsGraph, setShowFpsGraph] = useState(false);
    const fpsContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const pane = new Pane({ title: "Debug" });
        const params = { debugCamera: false, showFpsGraph: false };

        const player = game.scene.getGameObject(GameObjectName.Player);
        const playerCamera = player.getComponent(PlayerCamera);
        const playerController = player.getComponent(PlayerController);
        const debugCameraController = game.scene
            .getGameObject(GameObjectName.DebugCamera)
            .getComponent(DebugCameraController);

        pane.addBinding(params, "debugCamera", { label: "Debug Camera" }).on("change", ({ value }) => {
            debugCameraController.enabled = value;
            playerCamera.enabled = !value;
            playerController.enabled = !value;
        });

        pane.addBinding(params, "showFpsGraph", { label: "Show FPS" }).on("change", ({ value }) => {
            setShowFpsGraph(value);
        });

        return () => pane.dispose();
    }, [game]);

    useEffect(() => {
        if (!showFpsGraph || !fpsContainerRef.current) return;

        const fpsPane = new Pane({ container: fpsContainerRef.current });
        fpsPane.addBinding(game.scene, "fps", {
            readonly: true,
            label: "FPS",
            format: value => Math.round(value).toString(),
            interval: 100,
        });
        fpsPane.addBinding(game.scene, "fps", {
            readonly: true,
            view: "graph",
            label: "",
            min: 0,
            max: 144,
            interval: 100,
        });

        return () => fpsPane.dispose();
    }, [game, showFpsGraph]);

    return <div ref={fpsContainerRef} style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none" }} />;
}
