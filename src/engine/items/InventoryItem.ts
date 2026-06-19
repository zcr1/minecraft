import { BlockType } from "engine/block/BlockType";
import { ItemType } from "engine/items/ItemType";

// Represents any stack-able thing that can occupy an inventory slot.
// Blocks are placeable world voxels; items are carry-only (resources, tools, etc.).
export type InventoryItemStack =
    | { readonly kind: "block"; readonly type: BlockType }
    | { readonly kind: "item"; readonly type: ItemType };

// Returns true when both values refer to the same item type, including the null == null case.
// Does not consider stack count — use this to test identity, not quantity.
export function itemStacksEqual(a: InventoryItemStack | null, b: InventoryItemStack | null): boolean {
    if (a === null && b === null) {
        return true;
    }
    if (a === null || b === null) {
        return false;
    }
    return a.kind === b.kind && a.type === b.type;
}
