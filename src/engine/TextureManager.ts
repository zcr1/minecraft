import bedrockUrl from "assets/textures/blocks/bedrock.png";
import coalOreUrl from "assets/textures/blocks/coal_ore.png";
import cobbleUrl from "assets/textures/blocks/cobblestone.png";
import craftingTableUrl from "assets/textures/blocks/crafting_table.png";
import craftingTableBackUrl from "assets/textures/blocks/crafting_table_back.png";
import craftingTableFrontUrl from "assets/textures/blocks/crafting_table_front.png";
import craftingTableTopUrl from "assets/textures/blocks/crafting_table_top.png";
import dirtUrl from "assets/textures/blocks/dirt.png";
import dirtSnowBottomUrl from "assets/textures/blocks/dirt_snow_bottom.png";
import dirtSnowSideUrl from "assets/textures/blocks/dirt_snow_side.png";
import dirtSnowTopUrl from "assets/textures/blocks/dirt_snow_top.png";
import grassSideUrl from "assets/textures/blocks/grass_side.png";
import grassTopUrl from "assets/textures/blocks/grass_top.png";
import oakLeaves1Url from "assets/textures/blocks/oak_leaves_1.png";
import oakLeaves2Url from "assets/textures/blocks/oak_leaves_2.png";
import oakLogUrl from "assets/textures/blocks/oak_log.png";
import oakLogTopUrl from "assets/textures/blocks/oak_log_top.png";
import oakPlankUrl from "assets/textures/blocks/oak_plank.png";
import snowUrl from "assets/textures/blocks/snow.png";
import stoneUrl from "assets/textures/blocks/stone.png";
import waterUrl from "assets/textures/blocks/water.png";
import coalUrl from "assets/textures/items/coal.png";
import stickUrl from "assets/textures/items/stick.png";
import torchUrl from "assets/textures/items/torch.png";
import desetroy0Url from "assets/textures/misc/destroy_0.png";
import desetroy1Url from "assets/textures/misc/destroy_1.png";
import desetroy2Url from "assets/textures/misc/destroy_2.png";
import desetroy3Url from "assets/textures/misc/destroy_3.png";
import desetroy4Url from "assets/textures/misc/destroy_4.png";
import desetroy5Url from "assets/textures/misc/destroy_5.png";
import desetroy6Url from "assets/textures/misc/destroy_6.png";
import desetroy7Url from "assets/textures/misc/destroy_7.png";
import desetroy8Url from "assets/textures/misc/destroy_8.png";
import desetroy9Url from "assets/textures/misc/destroy_9.png";
import * as THREE from "three";
import { BlockType } from "engine/chunk/ChunkComponent";
import { ItemType } from "engine/items/ItemType";
import { applyVertexLighting } from "engine/renderer/applyVertexLighting";

const DESTROY_STAGE_URLS = [
    desetroy0Url,
    desetroy1Url,
    desetroy2Url,
    desetroy3Url,
    desetroy4Url,
    desetroy5Url,
    desetroy6Url,
    desetroy7Url,
    desetroy8Url,
    desetroy9Url,
];

export const BLOCK_BREAK_STAGE_COUNT = DESTROY_STAGE_URLS.length;

class TextureManager {
    // Grass has two face variants (top vs side) so it lives outside the general record.
    private grassTopMat!: THREE.MeshStandardMaterial;
    private grassSideMat!: THREE.MeshStandardMaterial;

    // Oak log has two face variants: top/bottom use the end-grain texture, sides use the bark.
    private oakLogTopMat!: THREE.MeshStandardMaterial;
    private oakLogSideMat!: THREE.MeshStandardMaterial;

    // Crafting table has four face variants: top, front (-Z), back (+Z), sides/bottom.
    private craftingTableTopMat!: THREE.MeshStandardMaterial;
    private craftingTableFrontMat!: THREE.MeshStandardMaterial;
    private craftingTableBackMat!: THREE.MeshStandardMaterial;
    private craftingTableSideMat!: THREE.MeshStandardMaterial;

    private snowMat!: THREE.MeshStandardMaterial;

    // DirtSnow has three face variants: top (snow), sides (dirt+snow), bottom (dirt).
    private dirtSnowTopMat!: THREE.MeshStandardMaterial;
    private dirtSnowSideMat!: THREE.MeshStandardMaterial;
    private dirtSnowBottomMat!: THREE.MeshStandardMaterial;

    // Separate instance from the held-item flat material so the two can diverge independently.
    private torchCrossMat!: THREE.MeshStandardMaterial;

    private waterMat!: THREE.MeshStandardMaterial;

    // Oak leaves use two textures distributed randomly by world position to break up repetition.
    private oakLeavesMats!: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial];

    private blockMaterials!: Partial<Record<BlockType, THREE.Material>>;
    // Flat-sprite materials for items rendered as planes (held item). Transparent + double-sided
    // so the alpha channel is respected and the face is visible from either direction.
    private flatItemMaterials!: Partial<Record<ItemType, THREE.Material>>;

    private desetroyTextures: THREE.Texture[] = [];

    init() {
        const loader = new THREE.TextureLoader();

        this.grassTopMat = this.loadMat(loader, grassTopUrl);
        this.grassSideMat = this.loadMat(loader, grassSideUrl);

        this.oakLogTopMat = this.loadMat(loader, oakLogTopUrl);
        this.oakLogSideMat = this.loadMat(loader, oakLogUrl);

        this.craftingTableTopMat = this.loadMat(loader, craftingTableTopUrl);
        this.craftingTableFrontMat = this.loadMat(loader, craftingTableFrontUrl);
        this.craftingTableBackMat = this.loadMat(loader, craftingTableBackUrl);
        this.craftingTableSideMat = this.loadMat(loader, craftingTableUrl);

        this.oakLeavesMats = [
            this.loadTransparentMat(loader, oakLeaves1Url),
            this.loadTransparentMat(loader, oakLeaves2Url),
        ];

        this.snowMat = this.loadMat(loader, snowUrl);

        this.dirtSnowTopMat = this.loadMat(loader, dirtSnowTopUrl);
        this.dirtSnowSideMat = this.loadMat(loader, dirtSnowSideUrl);
        this.dirtSnowBottomMat = this.loadMat(loader, dirtSnowBottomUrl);

        this.blockMaterials = {
            [BlockType.Dirt]: this.loadMat(loader, dirtUrl),
            [BlockType.Bedrock]: this.loadMat(loader, bedrockUrl),
            [BlockType.Stone]: this.loadMat(loader, stoneUrl),
            [BlockType.Cobblestone]: this.loadMat(loader, cobbleUrl),
            [BlockType.CoalOre]: this.loadMat(loader, coalOreUrl),
            [BlockType.OakPlanks]: this.loadMat(loader, oakPlankUrl),
        };

        this.flatItemMaterials = {
            [ItemType.Coal]: this.loadFlatMat(loader, coalUrl),
            [ItemType.Stick]: this.loadFlatMat(loader, stickUrl),
            [ItemType.Torch]: this.loadFlatMat(loader, torchUrl),
        };

        this.torchCrossMat = this.loadFlatMat(loader, torchUrl);
        this.waterMat = this.loadWaterMat(loader, waterUrl);
        // Emissive warm-amber tint so placed torches glow with the same colour as the held-item
        // PointLight (0xffaa44). Without this, applyVertexLighting multiplies by a greyscale
        // aLight and the sprite renders under neutral ambient/sun — matching the held version
        // requires the material to self-illuminate with the torch-flame colour.
        this.torchCrossMat.emissive.setHex(0xffaa44);
        this.torchCrossMat.emissiveIntensity = 0.6;

        this.desetroyTextures = DESTROY_STAGE_URLS.map(url => {
            const tex = loader.load(url);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            return tex;
        });
    }

    // Returned materials have applyVertexLighting baked in: their shader reads a per-vertex
    // `aLight` Float attribute (0-15) and multiplies the diffuse color by mix(MIN_LIGHT, 1.0,
    // aLight / 15.0). Any geometry drawn with these materials MUST declare the `aLight`
    // attribute, or every fragment will read 0 and render at the MIN_LIGHT floor (~10%).
    // See DroppedItems.createItemGeometry for a non-chunk consumer that meets this contract.
    getMaterial(blockType: BlockType, normalY: number): THREE.Material {
        if (blockType === BlockType.Grass) {
            return normalY === 1 ? this.grassTopMat : this.grassSideMat;
        }
        if (blockType === BlockType.OakLog) {
            // normalY !== 0 covers both +Y (top) and -Y (bottom) — both show end-grain texture.
            return normalY !== 0 ? this.oakLogTopMat : this.oakLogSideMat;
        }
        const material = this.blockMaterials[blockType];
        if (!material) {
            throw new Error(`TextureManager: no material registered for BlockType.${BlockType[blockType]}`);
        }
        return material;
    }

    // Front (-Z normal) shows the crafting grid face; back (+Z) shows the plain back; top shows
    // the grid on top; all other faces (±X sides, bottom) use the generic side/bottom texture.
    getCraftingTableMaterial(_: number, normalY: number, normalZ: number): THREE.Material {
        if (normalY === 1) {
            return this.craftingTableTopMat;
        }
        if (normalZ === -1) {
            return this.craftingTableFrontMat;
        }
        if (normalZ === 1) {
            return this.craftingTableBackMat;
        }
        return this.craftingTableSideMat;
    }

    // Returns one of the two leaf materials. The variant (0 or 1) is chosen per-block by
    // a world-position hash in ChunkComponent.buildMesh so the canopy looks random but
    // stays deterministic across rebuilds.
    getLeavesMaterial(variant: 0 | 1): THREE.Material {
        return this.oakLeavesMats[variant];
    }

    getSnowMaterial(): THREE.Material {
        return this.snowMat;
    }

    getDirtSnowMaterial(normalY: number): THREE.Material {
        if (normalY === 1) {
            return this.dirtSnowTopMat;
        }
        if (normalY === -1) {
            return this.dirtSnowBottomMat;
        }
        return this.dirtSnowSideMat;
    }

    createBlockBreakMaterial(): THREE.MeshBasicMaterial {
        const material = new THREE.MeshBasicMaterial({
            map: this.desetroyTextures[0],
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
        });
        return material;
    }

    setBlockBreakStage(material: THREE.MeshBasicMaterial, stageIndex: number): void {
        const clamped = Math.max(0, Math.min(BLOCK_BREAK_STAGE_COUNT - 1, stageIndex));
        const texture = this.desetroyTextures[clamped];
        if (material.map !== texture) {
            material.map = texture;
            material.needsUpdate = true;
        }
    }

    // Returns the DoubleSide transparent material used for torch cross-quad geometry in chunks.
    getTorchMaterial(): THREE.MeshStandardMaterial {
        return this.torchCrossMat;
    }

    // Returns the flat-sprite material for an item rendered as a plane (e.g. the held-item view).
    // Transparent + double-sided so the texture's alpha channel is honoured and the face is
    // visible regardless of which side the camera sees.
    getFlatItemMaterial(itemType: ItemType): THREE.Material {
        const material = this.flatItemMaterials[itemType] as THREE.Material | undefined;
        if (!material) {
            throw new Error(`TextureManager: no flat material registered for ItemType ${itemType}`);
        }
        return material;
    }

    private loadMat(loader: THREE.TextureLoader, url: string): THREE.MeshStandardMaterial {
        const tex = loader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        const material = new THREE.MeshStandardMaterial({ map: tex });
        applyVertexLighting(material);
        return material;
    }

    // Alpha-cutout variant for leaf blocks: transparent pixels are discarded (alphaTest),
    // but the face is otherwise lit and shaded like a regular opaque block.
    private loadTransparentMat(loader: THREE.TextureLoader, url: string): THREE.MeshStandardMaterial {
        const tex = loader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        const material = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5 });
        applyVertexLighting(material);
        return material;
    }

    private loadFlatMat(loader: THREE.TextureLoader, url: string): THREE.MeshStandardMaterial {
        const tex = loader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        const material = new THREE.MeshStandardMaterial({
            map: tex,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide,
        });
        applyVertexLighting(material);
        return material;
    }

    // Partially-transparent water surface: blue-tinted texture with alpha blending.
    // depthWrite is disabled so transparent faces don't incorrectly occlude geometry
    // behind them when chunks render in arbitrary order.
    private loadWaterMat(loader: THREE.TextureLoader, url: string): THREE.MeshStandardMaterial {
        const tex = loader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        const material = new THREE.MeshStandardMaterial({
            map: tex,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            color: new THREE.Color(0x3399ff),
        });
        applyVertexLighting(material);
        return material;
    }

    getWaterMaterial(): THREE.MeshStandardMaterial {
        return this.waterMat;
    }
}

export default new TextureManager();
