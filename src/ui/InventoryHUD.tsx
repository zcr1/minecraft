import classNames from "classnames";
import { useEffect, useMemo, useReducer, useState } from "react";
import eventManager from "engine/core/EventManager";
import Inventory, { HOTBAR_SIZE, type InventorySlot, TOTAL_SLOTS } from "engine/player/Inventory";
import GameObjectName from "engine/utils/gameObjectNames";
import { useGame } from "./GameContext";
import "./InventoryHUD.scss";
import { BLOCK_TEXTURE_URLS, ITEM_TEXTURE_URLS } from "./blockTextures";

interface SlotCellProps {
    slot: InventorySlot | null;
    isSelected: boolean;
}

function SlotCell({ slot, isSelected }: SlotCellProps) {
    let textureUrl: string | undefined;
    if (slot) {
        if (slot.item.kind === "block") {
            textureUrl = BLOCK_TEXTURE_URLS[slot.item.type];
        } else {
            textureUrl = ITEM_TEXTURE_URLS[slot.item.type];
        }
    }
    return (
        <div className={classNames("inventory-slot", { "inventory-slot-selected": isSelected })}>
            {slot && textureUrl && (
                <>
                    <img className="inventory-slot-icon" src={textureUrl} alt="" draggable={false} />
                    {slot.count > 1 && <span className="inventory-slot-count">{slot.count}</span>}
                </>
            )}
        </div>
    );
}

export default function InventoryHUD() {
    const game = useGame();
    const [, forceRender] = useReducer((value: number) => value + 1, 0);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(0);

    const inventory = useMemo(() => game.getGameObject(GameObjectName.Player).getComponent(Inventory), [game]);

    // Re-render whenever inventory contents change.
    useEffect(() => {
        const listener = () => forceRender();
        eventManager.subscribe("inventoryChanged", listener);
        return () => eventManager.unsubscribe("inventoryChanged", listener);
    }, []);

    // Track selected hotbar slot.
    useEffect(() => {
        const listener = (slotIndex: number) => setSelectedSlot(slotIndex);
        eventManager.subscribe("hotbarSelectionChanged", listener);
        return () => eventManager.unsubscribe("hotbarSelectionChanged", listener);
    }, []);

    // Toggle main inventory with E. Release pointer lock on open so the cursor is visible.
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "e" || event.key === "E") {
                setInventoryOpen(previous => {
                    const opening = !previous;
                    if (opening && document.pointerLockElement) {
                        document.exitPointerLock();
                    }
                    return opening;
                });
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    const slots = inventory.getSlots();
    const hotbarSlots = slots.slice(0, HOTBAR_SIZE);
    const mainSlots = slots.slice(HOTBAR_SIZE, TOTAL_SLOTS);

    return (
        <div className="inventory-hud">
            {inventoryOpen && (
                <div className="inventory-grid">
                    {mainSlots.map((slot, index) => (
                        <SlotCell key={index} slot={slot} isSelected={false} />
                    ))}
                </div>
            )}
            <div className="hotbar">
                {hotbarSlots.map((slot, index) => (
                    <SlotCell key={index} slot={slot} isSelected={index === selectedSlot} />
                ))}
            </div>
        </div>
    );
}
