import { InventoryItemStack } from "engine/items/InventoryItem";
import { ItemType } from "engine/items/ItemType";
import { BlockType } from "./BlockType";

// Defines drops that are not identical to themselves
export const BLOCK_DROPS: Partial<Record<BlockType, InventoryItemStack>> = {
    [BlockType.Grass]: { kind: "block", type: BlockType.Dirt },
    [BlockType.DirtSnow]: { kind: "block", type: BlockType.Dirt },
    [BlockType.Stone]: { kind: "block", type: BlockType.Cobblestone },
    [BlockType.CoalOre]: { kind: "item", type: ItemType.Coal },
    // OakLog omitted — falls through to the default "drop itself" path.
    [BlockType.OakLeaves]: { kind: "item", type: ItemType.Stick },
    // Torch is stored as BlockType in the world but the player holds/places ItemType.Torch.
    [BlockType.Torch]: { kind: "item", type: ItemType.Torch },
};

// Drop probability per block type (0–1). Absent means 1.0 — always drops.
export const BLOCK_DROP_CHANCES: Partial<Record<BlockType, number>> = {
    [BlockType.OakLeaves]: 0.25,
};
