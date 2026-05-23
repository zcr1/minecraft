import { BlockType } from "engine/chunk/ChunkComponent";
import { ItemType } from "engine/items/ItemType";

// Represents any stack-able thing that can occupy an inventory slot.
// Blocks are placeable world voxels; items are carry-only (resources, tools, etc.).
export type InventoryItemStack =
    | { readonly kind: "block"; readonly type: BlockType }
    | { readonly kind: "item"; readonly type: ItemType };
