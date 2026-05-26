import { useEffect, useState } from "react";
import PlayerPhysics from "engine/player/PlayerPhysics";
import GameObjectName from "engine/utils/gameObjectNames";
import { useGame } from "./GameContext";

export default function UnderwaterOverlay() {
    const game = useGame();
    const [isUnderwater, setIsUnderwater] = useState(false);

    useEffect(() => {
        const physics = game.getGameObject(GameObjectName.Player).getComponent(PlayerPhysics);
        let rafId: number;
        const poll = () => {
            setIsUnderwater(physics.isHeadInWater);
            rafId = requestAnimationFrame(poll);
        };
        rafId = requestAnimationFrame(poll);
        return () => cancelAnimationFrame(rafId);
    }, [game]);

    if (!isUnderwater) {
        return null;
    }

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 60, 160, 0.35)",
                pointerEvents: "none",
                zIndex: 10,
            }}
        />
    );
}
