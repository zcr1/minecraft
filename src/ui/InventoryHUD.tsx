import classNames from "classnames";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import eventManager from "engine/core/EventManager";
import type { CraftingGrid } from "engine/crafting/recipes";
import { matchRecipe } from "engine/crafting/recipes";
import Inventory, { HOTBAR_SIZE, type InventorySlot, TOTAL_SLOTS } from "engine/player/Inventory";
import GameObjectName from "engine/utils/gameObjectNames";
import CraftingPanel, { CRAFTING_OUTPUT_SLOT, CRAFTING_SLOT_OFFSET } from "./CraftingPanel";
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

const EMPTY_CRAFTING_GRID: (InventorySlot | null)[] = [null, null, null, null];

export default function InventoryHUD() {
    const game = useGame();
    const [, forceRender] = useReducer((value: number) => value + 1, 0);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(0);
    const [dragState, setDragState] = useState<{ sourceSlot: number; item: InventorySlot } | null>(null);
    const [craftingGrid, setCraftingGrid] = useState<(InventorySlot | null)[]>([...EMPTY_CRAFTING_GRID]);
    const hoveredSlotRef = useRef<number | null>(null);
    const dragCursorRef = useRef<HTMLDivElement>(null);

    const inventory = useMemo(() => game.getGameObject(GameObjectName.Player).getComponent(Inventory), [game]);

    // Derive the crafting output from the current grid contents.
    const craftingOutput = useMemo(() => {
        const grid = craftingGrid.map(slot => slot?.item ?? null) as CraftingGrid;
        const recipe = matchRecipe(grid);
        if (!recipe) {
            return null;
        }
        return { item: recipe.output, count: recipe.outputCount } satisfies InventorySlot;
    }, [craftingGrid]);

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
            const sourceSlot = dragState.sourceSlot;

            if (targetSlot === null) {
                // Dropped outside — remove from source and spawn in the world.
                if (sourceSlot < CRAFTING_SLOT_OFFSET) {
                    inventory.removeSlot(sourceSlot);
                } else {
                    setCraftingGrid(previous => {
                        const next = [...previous];
                        next[sourceSlot - CRAFTING_SLOT_OFFSET] = null;
                        return next;
                    });
                }
                eventManager.emit("itemDropped", dragState.item);
            } else if (targetSlot !== sourceSlot) {
                const sourceIsInventory = sourceSlot < CRAFTING_SLOT_OFFSET;
                const targetIsInventory = targetSlot < CRAFTING_SLOT_OFFSET;
                const targetIsCraftingGrid = targetSlot >= CRAFTING_SLOT_OFFSET && targetSlot < CRAFTING_OUTPUT_SLOT;
                const targetIsOutput = targetSlot === CRAFTING_OUTPUT_SLOT;

                if (targetIsOutput) {
                    // Dropping onto the output slot is not allowed — cancel the drag.
                } else if (sourceIsInventory && targetIsInventory) {
                    // Both inventory slots: swap normally.
                    inventory.moveSlot(sourceSlot, targetSlot);
                } else if (sourceIsInventory && targetIsCraftingGrid) {
                    // Inventory → crafting grid: place exactly 1 item, consume 1 from source.
                    const craftingIndex = targetSlot - CRAFTING_SLOT_OFFSET;
                    const displaced = craftingGrid[craftingIndex];
                    // Skip the drop if the displaced crafting item has nowhere to go.
                    if (!displaced || inventory.canAdd(displaced.item)) {
                        if (dragState.item.count > 1) {
                            inventory.setSlot(sourceSlot, { ...dragState.item, count: dragState.item.count - 1 });
                        } else {
                            inventory.removeSlot(sourceSlot);
                        }
                        setCraftingGrid(previous => {
                            const next = [...previous];
                            next[craftingIndex] = { item: dragState.item.item, count: 1 };
                            return next;
                        });
                        if (displaced) {
                            inventory.add(displaced.item, displaced.count);
                        }
                    }
                } else if (!sourceIsInventory && targetIsInventory) {
                    // Crafting grid → inventory slot: swap the two slots.
                    const craftingIndex = sourceSlot - CRAFTING_SLOT_OFFSET;
                    const displaced = inventory.getSlot(targetSlot);
                    inventory.setSlot(targetSlot, dragState.item);
                    setCraftingGrid(previous => {
                        const next = [...previous];
                        next[craftingIndex] = displaced;
                        return next;
                    });
                } else {
                    // Both crafting grid: swap within the grid.
                    const sourceCraftingIndex = sourceSlot - CRAFTING_SLOT_OFFSET;
                    const targetCraftingIndex = targetSlot - CRAFTING_SLOT_OFFSET;
                    setCraftingGrid(previous => {
                        const next = [...previous];
                        [next[sourceCraftingIndex], next[targetCraftingIndex]] = [
                            next[targetCraftingIndex],
                            next[sourceCraftingIndex],
                        ];
                        return next;
                    });
                }
            }

            setDragState(null);
            hoveredSlotRef.current = null;
        };
        document.addEventListener("mouseup", handleMouseUp);
        return () => document.removeEventListener("mouseup", handleMouseUp);
    }, [dragState, inventory, craftingGrid]);

    const handleSlotMouseDown = (slotIndex: number, event: React.MouseEvent) => {
        // Clicking the output slot triggers a craft rather than starting a drag.
        if (slotIndex === CRAFTING_OUTPUT_SLOT) {
            if (craftingOutput) {
                handleCraft();
            }
            return;
        }

        let slot: InventorySlot | null;
        if (slotIndex < CRAFTING_SLOT_OFFSET) {
            slot = inventory.getSlot(slotIndex);
        } else {
            slot = craftingGrid[slotIndex - CRAFTING_SLOT_OFFSET];
        }

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

    // Consume one of each ingredient and add the output to the player's inventory.
    const handleCraft = () => {
        const grid = craftingGrid.map(slot => slot?.item ?? null) as CraftingGrid;
        const recipe = matchRecipe(grid);
        if (!recipe) {
            return;
        }
        inventory.add(recipe.output, recipe.outputCount);
        setCraftingGrid(previous =>
            previous.map(slot => {
                if (!slot) {
                    return null;
                }
                return slot.count > 1 ? { ...slot, count: slot.count - 1 } : null;
            }),
        );
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
                    <>
                        <CraftingPanel
                            craftingGrid={craftingGrid}
                            outputSlot={craftingOutput}
                            dragSourceSlot={dragState?.sourceSlot ?? null}
                            onSlotMouseDown={handleSlotMouseDown}
                            onSlotMouseEnter={handleSlotMouseEnter}
                            onSlotMouseLeave={handleSlotMouseLeave}
                        />
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
                    </>
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
