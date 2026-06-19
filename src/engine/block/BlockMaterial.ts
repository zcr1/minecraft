import { BlockType } from "engine/block/BlockType";

export enum BlockMaterial {
    Default = "Default",
    Stone = "Stone",
}

export const BASE_BREAK_TIME_SECONDS: Record<BlockMaterial, number> = {
    [BlockMaterial.Default]: 1.2,
    [BlockMaterial.Stone]: 4.0,
};

export const BLOCK_MATERIAL_BY_TYPE: Partial<Record<BlockType, BlockMaterial>> = {
    [BlockType.Stone]: BlockMaterial.Stone,
    [BlockType.CoalOre]: BlockMaterial.Stone,
    [BlockType.Cobblestone]: BlockMaterial.Stone,
};
