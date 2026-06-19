import { BASE_BREAK_TIME_SECONDS, BLOCK_MATERIAL_BY_TYPE, BlockMaterial } from "engine/block/BlockMaterial";
import { BlockType } from "engine/block/BlockType";
import { ItemType } from "engine/items/ItemType";
import type { InventorySlot } from "engine/player/Inventory";

// Speed multiplier for each tool per block material.
// breakTime = baseTime / multiplier
export const TOOL_SPEED_MULTIPLIERS: Partial<Record<ItemType, Partial<Record<BlockMaterial, number>>>> = {
    [ItemType.WoodenPickaxe]: { [BlockMaterial.Stone]: 2.0 },
    [ItemType.StonePickaxe]: { [BlockMaterial.Stone]: 4.0 },
};

export function computeBreakTime(blockType: BlockType, slot: InventorySlot | null): number {
    const material = BLOCK_MATERIAL_BY_TYPE[blockType] ?? BlockMaterial.Default;
    const baseTime = BASE_BREAK_TIME_SECONDS[material];

    if (!slot || slot.item.kind !== "item") {
        return baseTime;
    }
    const multipliers = TOOL_SPEED_MULTIPLIERS[slot.item.type];
    const multiplier = multipliers?.[material] ?? 1;
    return baseTime / multiplier;
}
