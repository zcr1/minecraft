import { Pane } from "tweakpane";
import { useEffect, useRef, useState } from "react";
import { BlockType } from "engine/block/BlockType";
import Transform from "engine/components/Transform";
import ChunkBoundaryOverlay from "engine/effects/ChunkBoundaryOverlay";
import DayNightCycle from "engine/environment/DayNightCycle";
import Inventory from "engine/player/Inventory";
import PlayerBlockInteraction from "engine/player/PlayerBlockInteraction";
import PlayerPhysics from "engine/player/PlayerPhysics";
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
        const params = {
            noClip: false,
            showFpsGraph: false,
            showPlayerPosition: false,
            instantBreak: false,
            showChunkBoundaries: false,
        };

        const dayNightCycle = game.getGameObject(GameObjectName.Sky).getComponent(DayNightCycle);
        const player = game.getGameObject(GameObjectName.Player);
        const inventory = player.getComponent(Inventory);
        const playerPhysics = player.getComponent(PlayerPhysics);
        const playerBlockInteraction = player.getComponent(PlayerBlockInteraction);
        const chunkBoundaryOverlay = game
            .getGameObject(GameObjectName.ChunkBoundaryOverlay)
            .getComponent(ChunkBoundaryOverlay);

        pane.addBinding(params, "noClip", { label: "No Clip" }).on("change", ({ value }) => {
            playerPhysics.noClipEnabled = value;
        });

        pane.addBinding(params, "showFpsGraph", { label: "Show FPS" }).on("change", ({ value }) => {
            setShowFpsGraph(value);
        });

        pane.addBinding(params, "showPlayerPosition", { label: "Show Player Position" }).on("change", ({ value }) => {
            setShowPlayerPosition(value);
        });

        pane.addBinding(params, "instantBreak", { label: "Instant Break" }).on("change", ({ value }) => {
            playerBlockInteraction.setInstantBreak(value);
        });

        pane.addBinding(params, "showChunkBoundaries", { label: "Show Chunk Boundaries" }).on("change", ({ value }) => {
            chunkBoundaryOverlay.showBoundaries = value;
        });

        pane.addButton({ title: "Spawn TNT" }).on("click", () => {
            inventory.add({ kind: "block", type: BlockType.TNT }, 64);
        });

        pane.addBinding(dayNightCycle, "timeOfDay", {
            label: "Time of Day",
            min: 0,
            max: 1,
            step: 0.0001,
            format: (value: number) => {
                const hours = Math.floor(value * 24);
                const minutes = Math.floor((value * 24 - hours) * 60);
                return `${hours}:${minutes.toString().padStart(2, "0")}`;
            },
        });

        const refreshId = setInterval(() => pane.refresh(), 100);

        return () => {
            clearInterval(refreshId);
            pane.dispose();
        };
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
