import classNames from "classnames";
import type { InventorySlot } from "engine/player/Inventory";
import "./CraftingPanel.scss";
import { BLOCK_TEXTURE_URLS, ITEM_TEXTURE_URLS } from "./blockTextures";

// Virtual slot indices used to identify crafting slots within the shared drag system.
// Slots 36–39 are the 2×2 grid (row-major); slot 40 is the output.
export const CRAFTING_SLOT_OFFSET = 36;
export const CRAFTING_OUTPUT_SLOT = 40;

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
    // 4-element array: [top-left, top-right, bottom-left, bottom-right]
    craftingGrid: (InventorySlot | null)[];
    outputSlot: InventorySlot | null;
    dragSourceSlot: number | null;
    onSlotMouseDown: (index: number, event: React.MouseEvent) => void;
    onSlotMouseEnter: (index: number) => void;
    onSlotMouseLeave: () => void;
}

export default function CraftingPanel({
    craftingGrid,
    outputSlot,
    dragSourceSlot,
    onSlotMouseDown,
    onSlotMouseEnter,
    onSlotMouseLeave,
}: CraftingPanelProps) {
    return (
        <div className="crafting-panel">
            <span className="crafting-label">Crafting</span>
            <div className="crafting-panel-content">
                <div className="crafting-grid">
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
                    slotIndex={CRAFTING_OUTPUT_SLOT}
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
