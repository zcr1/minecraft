import { Pane } from "tweakpane";
import { useEffect, useRef, useState } from "react";
import Transform from "engine/components/Transform";
import DebugCameraController from "engine/debug/DebugCameraController";
import PlayerBlockInteraction, { BREAK_TIME_SECONDS } from "engine/player/PlayerBlockInteraction";
import PlayerCamera from "engine/player/PlayerCamera";
import PlayerController from "engine/player/PlayerController";
import GameObjectName from "engine/utils/gameObjectNames";
import { useGame } from "./GameContext";

export default function DebugMenu() {
    const game = useGame();
    const [showFpsGraph, setShowFpsGraph] = useState(false);
    const [showPlayerPosition, setShowPlayerPosition] = useState(false);
    const fpsContainerRef = useRef<HTMLDivElement | null>(null);
    const positionContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const pane = new Pane({ title: "Debug" });
        const params = { debugCamera: false, showFpsGraph: false, showPlayerPosition: false, breakTimeZero: false };

        const player = game.getGameObject(GameObjectName.Player);
        const playerCamera = player.getComponent(PlayerCamera);
        const playerController = player.getComponent(PlayerController);
        const playerBlockInteraction = player.getComponent(PlayerBlockInteraction);
        const debugCameraController = game
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

        pane.addBinding(params, "showPlayerPosition", { label: "Show Player Position" }).on("change", ({ value }) => {
            setShowPlayerPosition(value);
        });

        pane.addBinding(params, "breakTimeZero", { label: "Break Time Zero" }).on("change", ({ value }) => {
            playerBlockInteraction.breakTimeSeconds = value ? 0.01 : BREAK_TIME_SECONDS;
        });

        return () => pane.dispose();
    }, [game]);

    useEffect(() => {
        if (!showFpsGraph || !fpsContainerRef.current) return;

        const fpsPane = new Pane({ container: fpsContainerRef.current });
        fpsPane.addBinding(game, "fps", {
            readonly: true,
            label: "FPS",
            format: value => Math.round(value).toString(),
            interval: 100,
        });
        fpsPane.addBinding(game, "fps", {
            readonly: true,
            view: "graph",
            label: "",
            min: 0,
            max: 144,
            interval: 100,
        });

        return () => fpsPane.dispose();
    }, [game, showFpsGraph]);

    useEffect(() => {
        if (!showPlayerPosition || !positionContainerRef.current) {
            return;
        }

        const transform = game.getGameObject(GameObjectName.Player).getComponent(Transform);
        const positionPane = new Pane({ container: positionContainerRef.current });
        const formatPosition = (value: number) => value.toFixed(2);
        positionPane.addBinding(transform, "x", { readonly: true, label: "X", format: formatPosition, interval: 100 });
        positionPane.addBinding(transform, "y", { readonly: true, label: "Y", format: formatPosition, interval: 100 });
        positionPane.addBinding(transform, "z", { readonly: true, label: "Z", format: formatPosition, interval: 100 });

        return () => positionPane.dispose();
    }, [game, showPlayerPosition]);

    return (
        <>
            <div ref={fpsContainerRef} style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none" }} />
            <div ref={positionContainerRef} style={{ position: "fixed", top: 80, left: 0, pointerEvents: "none" }} />
        </>
    );
}
