import classNames from "classnames";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import eventManager from "engine/core/EventManager";
import type { InventorySlot } from "engine/player/Inventory";
import Inventory, { HOTBAR_SIZE, TOTAL_SLOTS } from "engine/player/Inventory";
import GameObjectName from "engine/utils/gameObjectNames";
import CraftingPanel, { CRAFTING_OUTPUT_SLOT, CRAFTING_TABLE_OUTPUT_SLOT } from "./CraftingPanel";
import { useGame } from "./GameContext";
import "./InventoryHUD.scss";
import { BLOCK_TEXTURE_URLS, ITEM_TEXTURE_URLS } from "./blockTextures";
import { useCraftingState, useCraftingTableState } from "./hooks/useCraftingState";
import { useDragSystem } from "./hooks/useDragSystem";
import { useHotbarSelection } from "./hooks/useHotbarSelection";
import { useInventorySync } from "./hooks/useInventorySync";
import { useInventoryToggle } from "./hooks/useInventoryToggle";

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
    const inventory = useMemo(() => game.getGameObject(GameObjectName.Player).getComponent(Inventory), [game]);

    useInventorySync();
    const selectedSlot = useHotbarSelection();

    const [craftingMode, setCraftingMode] = useState<"inventory" | "craftingTable">("inventory");

    const inventoryCraftingState = useCraftingState(inventory);
    const tableCraftingState = useCraftingTableState(inventory);
    const activeCraftingState = craftingMode === "craftingTable" ? tableCraftingState : inventoryCraftingState;
    const craftingOutputSlot = craftingMode === "craftingTable" ? CRAFTING_TABLE_OUTPUT_SLOT : CRAFTING_OUTPUT_SLOT;

    const { dragState, dragCursorRef, cancelDrag, startDrag, onSlotMouseEnter, onSlotMouseLeave } = useDragSystem(
        inventory,
        activeCraftingState.craftingGrid,
        activeCraftingState.setCraftingGrid,
        craftingOutputSlot,
    );

    const handleClose = () => {
        setCraftingMode("inventory");
        cancelDrag();
    };

    const [inventoryOpen, setInventoryOpen] = useInventoryToggle(handleClose);

    // Subscribe to crafting table right-click event from the engine.
    useEffect(() => {
        const handleCraftingTableOpened = () => {
            setCraftingMode("craftingTable");
            setInventoryOpen(true);
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        };
        eventManager.subscribe("craftingTableOpened", handleCraftingTableOpened);
        return () => eventManager.unsubscribe("craftingTableOpened", handleCraftingTableOpened);
    }, [setInventoryOpen]);

    const handleSlotMouseDown = (slotIndex: number, event: React.MouseEvent) => {
        if (slotIndex === craftingOutputSlot) {
            if (activeCraftingState.craftingOutput) {
                activeCraftingState.handleCraft();
            }
            return;
        }
        startDrag(slotIndex, event);
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
                            craftingGrid={activeCraftingState.craftingGrid}
                            outputSlot={activeCraftingState.craftingOutput}
                            outputSlotIndex={craftingOutputSlot}
                            dragSourceSlot={dragState?.sourceSlot ?? null}
                            onSlotMouseDown={handleSlotMouseDown}
                            onSlotMouseEnter={onSlotMouseEnter}
                            onSlotMouseLeave={onSlotMouseLeave}
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
                                    onSlotMouseEnter={onSlotMouseEnter}
                                    onSlotMouseLeave={onSlotMouseLeave}
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
                            onSlotMouseEnter={onSlotMouseEnter}
                            onSlotMouseLeave={onSlotMouseLeave}
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
