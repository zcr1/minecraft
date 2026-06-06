import classNames from "classnames";
import type { InventorySlot } from "engine/player/Inventory";
import "./CraftingPanel.scss";
import { BLOCK_TEXTURE_URLS, ITEM_TEXTURE_URLS } from "./blockTextures";

// Virtual slot indices used to identify crafting slots within the shared drag system.
// Only one crafting panel is ever active at a time, so these ranges don't conflict:
// 2×2 mode: slots 36–39 are the grid, slot 40 is the output.
// 3×3 mode: slots 36–44 are the grid, slot 45 is the output.
export const CRAFTING_SLOT_OFFSET = 36;
export const CRAFTING_OUTPUT_SLOT = 40;
export const CRAFTING_TABLE_OUTPUT_SLOT = 45;

function getTextureUrl(slot: InventorySlot): string | undefined {
    if (slot.item.kind === "block") {
        return BLOCK_TEXTURE_URLS[slot.item.type];
    }
    return ITEM_TEXTURE_URLS[slot.item.type];
}

interface CraftingSlotProps {
    slot: InventorySlot | null;
    slotIndex: number;
    isDragSource: boolean;
    isOutput?: boolean;
    onSlotMouseDown: (index: number, event: React.MouseEvent) => void;
    onSlotMouseEnter: (index: number) => void;
    onSlotMouseLeave: () => void;
}

function CraftingSlot({
    slot,
    slotIndex,
    isDragSource,
    isOutput,
    onSlotMouseDown,
    onSlotMouseEnter,
    onSlotMouseLeave,
}: CraftingSlotProps) {
    const textureUrl = slot ? getTextureUrl(slot) : undefined;
    const showContents = slot && textureUrl && !isDragSource;

    return (
        <div
            className={classNames("inventory-slot", {
                "inventory-slot-drag-source": isDragSource,
                "crafting-output-slot": isOutput,
            })}
            onMouseDown={event => onSlotMouseDown(slotIndex, event)}
            onMouseEnter={() => onSlotMouseEnter(slotIndex)}
            onMouseLeave={onSlotMouseLeave}
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

interface CraftingPanelProps {
    // 4-element array for 2×2, 9-element array for 3×3 (row-major)
    craftingGrid: (InventorySlot | null)[];
    outputSlot: InventorySlot | null;
    outputSlotIndex: number;
    dragSourceSlot: number | null;
    onSlotMouseDown: (index: number, event: React.MouseEvent) => void;
    onSlotMouseEnter: (index: number) => void;
    onSlotMouseLeave: () => void;
}

export default function CraftingPanel({
    craftingGrid,
    outputSlot,
    outputSlotIndex,
    dragSourceSlot,
    onSlotMouseDown,
    onSlotMouseEnter,
    onSlotMouseLeave,
}: CraftingPanelProps) {
    return (
        <div className="crafting-panel">
            <span className="crafting-label">Crafting</span>
            <div className="crafting-panel-content">
                <div className={classNames("crafting-grid", { "crafting-grid-3x3": craftingGrid.length === 9 })}>
                    {craftingGrid.map((slot, index) => (
                        <CraftingSlot
                            key={index}
                            slot={slot}
                            slotIndex={CRAFTING_SLOT_OFFSET + index}
                            isDragSource={dragSourceSlot === CRAFTING_SLOT_OFFSET + index}
                            onSlotMouseDown={onSlotMouseDown}
                            onSlotMouseEnter={onSlotMouseEnter}
                            onSlotMouseLeave={onSlotMouseLeave}
                        />
                    ))}
                </div>
                <div className="crafting-arrow">▶</div>
                <CraftingSlot
                    slot={outputSlot}
                    slotIndex={outputSlotIndex}
                    isDragSource={false}
                    isOutput
                    onSlotMouseDown={onSlotMouseDown}
                    onSlotMouseEnter={onSlotMouseEnter}
                    onSlotMouseLeave={onSlotMouseLeave}
                />
            </div>
        </div>
    );
}
