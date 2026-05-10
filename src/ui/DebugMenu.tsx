import { Pane } from "tweakpane";
import { useEffect } from "react";
import DebugCameraController from "engine/debug/DebugCameraController";
import PlayerCamera from "engine/player/PlayerCamera";
import PlayerController from "engine/player/PlayerController";
import GameObjectName from "engine/utils/gameObjectNames";
import { useGame } from "./GameContext";

export default function DebugMenu() {
    const game = useGame();

    useEffect(() => {
        const pane = new Pane({ title: "Debug" });
        const params = { debugCamera: false };

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

        return () => pane.dispose();
    }, [game]);

    return null;
}
