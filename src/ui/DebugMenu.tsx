import { useControls } from "leva";
import { useEffect, type RefObject } from "react";
import type DebugCameraController from "engine/debug/DebugCameraController";
import type PlayerCamera from "engine/player/PlayerCamera";

interface Props {
    playerCamera: RefObject<PlayerCamera | null>;
    debugCamera: RefObject<DebugCameraController | null>;
}

export default function DebugMenu({ playerCamera, debugCamera }: Props) {
    const [{ debugCameraEnabled }] = useControls(() => ({
        debugCameraEnabled: { value: false, label: "Debug Camera" },
    }));

    useEffect(() => {
        if (playerCamera.current) playerCamera.current.enabled = !debugCameraEnabled;
        if (debugCamera.current) debugCamera.current.enabled = debugCameraEnabled;
    }, [debugCameraEnabled]);

    return null;
}
