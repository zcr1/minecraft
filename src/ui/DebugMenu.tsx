import { useEffect } from "react";
import { Pane } from "tweakpane";
import { useGame } from "./GameContext";
import PlayerCamera from "engine/player/PlayerCamera";
import PlayerController from "engine/player/PlayerController";
import DebugCameraController from "engine/debug/DebugCameraController";
import GameObjectName from "engine/utils/gameObjectNames";

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
    }, []);

    return null;
}
