export enum BlockType {
    Air = 0,
    Dirt = 1,
    Grass = 2,
    Bedrock = 3,
    Stone = 4,
    Cobblestone = 5,
    CoalOre = 6,
    OakLog = 7,
    OakLeaves = 8,
    Torch = 9,
    Water = 10,
    OakPlanks = 11,
    CraftingTable = 12,
    Snow = 13,
    DirtSnow = 14,
    TNT = 15,
}

export const INDESTRUCTIBLE_BLOCKS = new Set<BlockType>([BlockType.Air, BlockType.Bedrock, BlockType.Water]);

export const INSTANT_BREAK_BLOCKS = new Set<BlockType>([BlockType.OakLeaves, BlockType.Snow, BlockType.Torch]);

// Blocks the player can walk through (non-solid).
export function isPassableBlock(blockType: BlockType): boolean {
    return blockType === BlockType.Air || blockType === BlockType.Torch || blockType === BlockType.Water;
}

// Returns true for opaque, solid blocks that can support placements (e.g. torches on walls/floors).
export function isSolidBlock(blockType: BlockType): boolean {
    return (
        blockType !== BlockType.Air &&
        blockType !== BlockType.Torch &&
        blockType !== BlockType.OakLeaves &&
        blockType !== BlockType.Water
    );
}
