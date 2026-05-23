import bedrockUrl from "assets/textures/bedrock.png";
import coalUrl from "assets/textures/coal.png";
import coalOreUrl from "assets/textures/coal_ore.png";
import cobbleUrl from "assets/textures/cobblestone.png";
import desetroy0Url from "assets/textures/destroy_0.png";
import desetroy1Url from "assets/textures/destroy_1.png";
import desetroy2Url from "assets/textures/destroy_2.png";
import desetroy3Url from "assets/textures/destroy_3.png";
import desetroy4Url from "assets/textures/destroy_4.png";
import desetroy5Url from "assets/textures/destroy_5.png";
import desetroy6Url from "assets/textures/destroy_6.png";
import desetroy7Url from "assets/textures/destroy_7.png";
import desetroy8Url from "assets/textures/destroy_8.png";
import desetroy9Url from "assets/textures/destroy_9.png";
import dirtUrl from "assets/textures/dirt.png";
import grassSideUrl from "assets/textures/grass_side.png";
import grassTopUrl from "assets/textures/grass_top.png";
import stoneUrl from "assets/textures/stone.png";
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

    private blockMaterials!: Partial<Record<BlockType, THREE.Material>>;
    private itemMaterials!: Record<ItemType, THREE.Material>;

    private desetroyTextures: THREE.Texture[] = [];

    init() {
        const loader = new THREE.TextureLoader();

        this.grassTopMat = this.loadMat(loader, grassTopUrl);
        this.grassSideMat = this.loadMat(loader, grassSideUrl);

        this.blockMaterials = {
            [BlockType.Dirt]: this.loadMat(loader, dirtUrl),
            [BlockType.Bedrock]: this.loadMat(loader, bedrockUrl),
            [BlockType.Stone]: this.loadMat(loader, stoneUrl),
            [BlockType.Cobblestone]: this.loadMat(loader, cobbleUrl),
            [BlockType.CoalOre]: this.loadMat(loader, coalOreUrl),
        };

        this.itemMaterials = {
            [ItemType.Coal]: this.loadMat(loader, coalUrl),
        };

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
        const material = this.blockMaterials[blockType];
        if (!material) {
            throw new Error(`TextureManager: no material registered for BlockType ${blockType}`);
        }
        return material;
    }

    // Returns the material for a held or dropped item. The `normalY` parameter mirrors
    // getMaterial so callers can use the same face-index convention (normalY === 1 → top face).
    // New item types must be added to itemMaterials in init() — the Record type enforces this
    // at compile time. The runtime guard below defends against invalid numeric casts.
    getItemMaterial(itemType: ItemType, _normalY: number): THREE.Material {
        const material = this.itemMaterials[itemType] as THREE.Material | undefined;
        if (!material) {
            throw new Error(`TextureManager: no material registered for ItemType ${itemType}`);
        }
        return material;
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

    private loadMat(loader: THREE.TextureLoader, url: string): THREE.MeshStandardMaterial {
        const tex = loader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        const material = new THREE.MeshStandardMaterial({ map: tex });
        applyVertexLighting(material);
        return material;
    }
}

export default new TextureManager();
