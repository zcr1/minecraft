import crosshairUrl from "assets/textures/crosshair.png";
import { useEffect, useState } from "react";
import eventManager from "engine/core/EventManager";
import type { TargetedBlock } from "engine/player/PlayerBlockInteraction";

const OPACITY_DEFAULT = 0.5;
const OPACITY_TARGETING = 1;

export default function Crosshair() {
    const [hasTarget, setHasTarget] = useState(false);

    useEffect(() => {
        const listener = (target: TargetedBlock | null) => setHasTarget(target !== null);
        eventManager.subscribe("targetedBlockChanged", listener);
        return () => eventManager.unsubscribe("targetedBlockChanged", listener);
    }, []);

    return (
        <img
            src={crosshairUrl}
            alt=""
            style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 64,
                height: 64,
                opacity: hasTarget ? OPACITY_TARGETING : OPACITY_DEFAULT,
                pointerEvents: "none",
                imageRendering: "pixelated",
            }}
        />
    );
}
