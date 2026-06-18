import bedrockUrl from "assets/textures/blocks/bedrock.png";
import cobbleUrl from "assets/textures/blocks/cobblestone.png";
import craftingTableTopUrl from "assets/textures/blocks/crafting_table_top.png";
import dirtUrl from "assets/textures/blocks/dirt.png";
import dirtSnowTopUrl from "assets/textures/blocks/dirt_snow_top.png";
import grassTopUrl from "assets/textures/blocks/grass_top.png";
import oakLeaves1Url from "assets/textures/blocks/oak_leaves_1.png";
import oakLogTopUrl from "assets/textures/blocks/oak_log_top.png";
import oakPlankUrl from "assets/textures/blocks/oak_plank.png";
import snowUrl from "assets/textures/blocks/snow.png";
import stoneUrl from "assets/textures/blocks/stone.png";
import coalUrl from "assets/textures/items/coal.png";
import stickUrl from "assets/textures/items/stick.png";
import stonePickaxeUrl from "assets/textures/items/stone_pickaxe.png";
import stoneSwordUrl from "assets/textures/items/stone_sword.png";
import torchUrl from "assets/textures/items/torch.png";
import woodenPickaxeUrl from "assets/textures/items/wooden_pickaxe.png";
import woodenSwordUrl from "assets/textures/items/wooden_sword.png";
import { BlockType } from "engine/chunk/ChunkComponent";
import { ItemType } from "engine/items/ItemType";

// Maps each block type to an image URL suitable for use in <img src>.
// Uses the same Vite asset imports as TextureManager so no extra copies are bundled.
// Grass uses the top-face texture as its inventory icon.
export const BLOCK_TEXTURE_URLS: Partial<Record<BlockType, string>> = {
    [BlockType.Dirt]: dirtUrl,
    [BlockType.Grass]: grassTopUrl,
    [BlockType.Bedrock]: bedrockUrl,
    [BlockType.Stone]: stoneUrl,
    [BlockType.Cobblestone]: cobbleUrl,
    [BlockType.OakLog]: oakLogTopUrl,
    [BlockType.OakLeaves]: oakLeaves1Url,
    [BlockType.OakPlanks]: oakPlankUrl,
    [BlockType.CraftingTable]: craftingTableTopUrl,
    [BlockType.Snow]: snowUrl,
    [BlockType.DirtSnow]: dirtSnowTopUrl,
};

// Maps each item type to an image URL suitable for use in <img src>.
export const ITEM_TEXTURE_URLS: Partial<Record<ItemType, string>> = {
    [ItemType.Coal]: coalUrl,
    [ItemType.Stick]: stickUrl,
    [ItemType.Torch]: torchUrl,
    [ItemType.WoodenPickaxe]: woodenPickaxeUrl,
    [ItemType.StonePickaxe]: stonePickaxeUrl,
    [ItemType.WoodenSword]: woodenSwordUrl,
    [ItemType.StoneSword]: stoneSwordUrl,
};
