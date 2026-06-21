import { BlockType } from "engine/block/BlockType";

export enum ItemType {
    Coal = "Coal",
    Stick = "Stick",
    TNT = "TNT",
    Torch = "Torch",
    WoodenPickaxe = "WoodenPickaxe",
    StonePickaxe = "StonePickaxe",
    WoodenSword = "WoodenSword",
    StoneSword = "StoneSword",
}

// Maps placeable item types to the block they place in the world.
export const ITEM_TO_BLOCK: Partial<Record<ItemType, BlockType>> = {
    [ItemType.TNT]: BlockType.TNT,
    [ItemType.Torch]: BlockType.Torch,
};
