import { useEffect, type RefObject } from "react";
import { Pane } from "tweakpane";
import type DebugCameraController from "engine/debug/DebugCameraController";
import type PlayerCamera from "engine/player/PlayerCamera";

interface Props {
    playerCamera: RefObject<PlayerCamera | null>;
    debugCamera: RefObject<DebugCameraController | null>;
}

export default function DebugMenu({ playerCamera, debugCamera }: Props) {
    useEffect(() => {
        const pane = new Pane({ title: "Debug" });
        const params = { debugCamera: false };

        pane.addBinding(params, "debugCamera", { label: "Debug Camera" }).on("change", ({ value }) => {
            if (playerCamera.current) playerCamera.current.enabled = !value;
            if (debugCamera.current) debugCamera.current.enabled = value;
        });

        return () => pane.dispose();
    }, []);

    return null;
}
