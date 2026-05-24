import classNames from "classnames";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import eventManager from "engine/core/EventManager";
import Inventory, { HOTBAR_SIZE, type InventorySlot, TOTAL_SLOTS } from "engine/player/Inventory";
import GameObjectName from "engine/utils/gameObjectNames";
import { useGame } from "./GameContext";
import "./InventoryHUD.scss";
import { BLOCK_TEXTURE_URLS, ITEM_TEXTURE_URLS } from "./blockTextures";

function getTextureUrl(slot: InventorySlot): string | undefined {
    if (slot.item.kind === "block") {
        return BLOCK_TEXTURE_URLS[slot.item.type];
    }
    return ITEM_TEXTURE_URLS[slot.item.type];
}

interface SlotCellProps {
    slot: InventorySlot | null;
    slotIndex: number;
    isSelected: boolean;
    isDragSource: boolean;
    isInteractive: boolean;
    onSlotMouseDown: (index: number, event: React.MouseEvent) => void;
    onSlotMouseEnter: (index: number) => void;
    onSlotMouseLeave: () => void;
}

function SlotCell({
    slot,
    slotIndex,
    isSelected,
    isDragSource,
    isInteractive,
    onSlotMouseDown,
    onSlotMouseEnter,
    onSlotMouseLeave,
}: SlotCellProps) {
    const textureUrl = slot ? getTextureUrl(slot) : undefined;
    const showContents = slot && textureUrl && !isDragSource;

    return (
        <div
            className={classNames("inventory-slot", {
                "inventory-slot-selected": isSelected,
                "inventory-slot-drag-source": isDragSource,
            })}
            onMouseDown={isInteractive ? event => onSlotMouseDown(slotIndex, event) : undefined}
            onMouseEnter={isInteractive ? () => onSlotMouseEnter(slotIndex) : undefined}
            onMouseLeave={isInteractive ? onSlotMouseLeave : undefined}
        >
            {showContents && (
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
    const [dragState, setDragState] = useState<{ sourceSlot: number; item: InventorySlot } | null>(null);
    const hoveredSlotRef = useRef<number | null>(null);
    const dragCursorRef = useRef<HTMLDivElement>(null);

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
                    if (!opening) {
                        // Cancel any active drag when closing inventory.
                        setDragState(null);
                        hoveredSlotRef.current = null;
                    }
                    return opening;
                });
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // While dragging: update cursor position via direct DOM manipulation to avoid re-renders on every mousemove.
    useEffect(() => {
        if (!dragState) {
            return;
        }
        const handleMouseMove = (event: MouseEvent) => {
            if (dragCursorRef.current) {
                dragCursorRef.current.style.left = `${event.clientX}px`;
                dragCursorRef.current.style.top = `${event.clientY}px`;
            }
        };
        document.addEventListener("mousemove", handleMouseMove);
        return () => document.removeEventListener("mousemove", handleMouseMove);
    }, [dragState]);

    // While dragging: finalize or cancel the drag on mouseup.
    useEffect(() => {
        if (!dragState) {
            return;
        }
        const handleMouseUp = () => {
            const targetSlot = hoveredSlotRef.current;
            if (targetSlot !== null && targetSlot !== dragState.sourceSlot) {
                inventory.moveSlot(dragState.sourceSlot, targetSlot);
            } else if (targetSlot === null) {
                // Dropped outside the inventory — remove from slot and spawn in the world.
                inventory.removeSlot(dragState.sourceSlot);
                eventManager.emit("itemDropped", dragState.item);
            }
            setDragState(null);
            hoveredSlotRef.current = null;
        };
        document.addEventListener("mouseup", handleMouseUp);
        return () => document.removeEventListener("mouseup", handleMouseUp);
    }, [dragState, inventory]);

    const handleSlotMouseDown = (slotIndex: number, event: React.MouseEvent) => {
        const slot = inventory.getSlot(slotIndex);
        if (!slot) {
            return;
        }
        event.preventDefault();
        if (dragCursorRef.current) {
            dragCursorRef.current.style.left = `${event.clientX}px`;
            dragCursorRef.current.style.top = `${event.clientY}px`;
        }
        setDragState({ sourceSlot: slotIndex, item: slot });
    };

    const handleSlotMouseEnter = (slotIndex: number) => {
        hoveredSlotRef.current = slotIndex;
    };

    const handleSlotMouseLeave = () => {
        hoveredSlotRef.current = null;
    };

    const slots = inventory.getSlots();
    const hotbarSlots = slots.slice(0, HOTBAR_SIZE);
    const mainSlots = slots.slice(HOTBAR_SIZE, TOTAL_SLOTS);

    const dragTextureUrl = dragState ? getTextureUrl(dragState.item) : undefined;

    return (
        <>
            <div className={classNames("inventory-hud", { "inventory-hud-interactive": inventoryOpen })}>
                {inventoryOpen && (
                    <div className="inventory-grid">
                        {mainSlots.map((slot, index) => (
                            <SlotCell
                                key={index}
                                slot={slot}
                                slotIndex={HOTBAR_SIZE + index}
                                isSelected={false}
                                isDragSource={dragState?.sourceSlot === HOTBAR_SIZE + index}
                                isInteractive={inventoryOpen}
                                onSlotMouseDown={handleSlotMouseDown}
                                onSlotMouseEnter={handleSlotMouseEnter}
                                onSlotMouseLeave={handleSlotMouseLeave}
                            />
                        ))}
                    </div>
                )}
                <div className="hotbar">
                    {hotbarSlots.map((slot, index) => (
                        <SlotCell
                            key={index}
                            slot={slot}
                            slotIndex={index}
                            isSelected={index === selectedSlot}
                            isDragSource={dragState?.sourceSlot === index}
                            isInteractive={inventoryOpen}
                            onSlotMouseDown={handleSlotMouseDown}
                            onSlotMouseEnter={handleSlotMouseEnter}
                            onSlotMouseLeave={handleSlotMouseLeave}
                        />
                    ))}
                </div>
            </div>
            {createPortal(
                <div
                    ref={dragCursorRef}
                    className={classNames("inventory-drag-cursor", {
                        "inventory-drag-cursor-visible": dragState !== null,
                    })}
                >
                    {dragState && dragTextureUrl && (
                        <>
                            <img className="inventory-slot-icon" src={dragTextureUrl} alt="" draggable={false} />
                            {dragState.item.count > 1 && (
                                <span className="inventory-slot-count">{dragState.item.count}</span>
                            )}
                        </>
                    )}
                </div>,
                document.body,
            )}
        </>
    );
}
