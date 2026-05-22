import bedrockUrl from "assets/textures/bedrock.png";
import cobbleUrl from "assets/textures/cobblestone.png";
import dirtUrl from "assets/textures/dirt.png";
import grassTopUrl from "assets/textures/grass_top.png";
import stoneUrl from "assets/textures/stone.png";
import { BlockType } from "engine/chunk/ChunkComponent";

// Maps each breakable block type to an image URL suitable for use in <img src>.
// Uses the same Vite asset imports as TextureManager so no extra copies are bundled.
// Grass uses the top-face texture as its inventory icon.
export const BLOCK_TEXTURE_URLS: Partial<Record<BlockType, string>> = {
    [BlockType.Dirt]: dirtUrl,
    [BlockType.Grass]: grassTopUrl,
    [BlockType.Bedrock]: bedrockUrl,
    [BlockType.Stone]: stoneUrl,
    [BlockType.Cobblestone]: cobbleUrl,
};
