import { useEffect, useMemo, useReducer } from "react";
import { BlockType } from "engine/chunk/ChunkComponent";
import eventManager from "engine/core/EventManager";
import Inventory from "engine/player/Inventory";
import GameObjectName from "engine/utils/gameObjectNames";
import { useGame } from "./GameContext";
import "./InventoryHUD.scss";

const BLOCK_LABELS: Partial<Record<BlockType, string>> = {
    [BlockType.Dirt]: "Dirt",
    [BlockType.Grass]: "Grass",
    [BlockType.Bedrock]: "Bedrock",
};

export default function InventoryHUD() {
    const game = useGame();
    const [, forceRender] = useReducer((value: number) => value + 1, 0);
    const inventory = useMemo(() => game.getGameObject(GameObjectName.Player).getComponent(Inventory), [game]);

    useEffect(() => {
        const listener = () => forceRender();
        eventManager.subscribe("inventoryChanged", listener);
        return () => eventManager.unsubscribe("inventoryChanged", listener);
    }, [inventory]);

    const entries = Array.from(inventory.entries()).filter(([, count]) => count > 0);

    return (
        <div className="inventory-hud">
            {entries.length === 0 ? (
                <span className="inventory-hud__empty">Inventory empty</span>
            ) : (
                entries.map(([blockType, count]) => (
                    <span key={blockType}>
                        {BLOCK_LABELS[blockType]}: {count}
                    </span>
                ))
            )}
        </div>
    );
}
