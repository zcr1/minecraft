import { BlockType } from "engine/block/BlockType";

export enum ItemType {
    Coal = "Coal",
    Stick = "Stick",
    Torch = "Torch",
    WoodenPickaxe = "WoodenPickaxe",
    StonePickaxe = "StonePickaxe",
    WoodenSword = "WoodenSword",
    StoneSword = "StoneSword",
}

// Maps placeable item types to the block they place in the world.
export const ITEM_TO_BLOCK: Partial<Record<ItemType, BlockType>> = {
    [ItemType.Torch]: BlockType.Torch,
};
