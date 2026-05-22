import bedrockUrl from "assets/textures/bedrock.png";
import destroyStage0Url from "assets/textures/destroy_stage_0.png";
import destroyStage1Url from "assets/textures/destroy_stage_1.png";
import destroyStage2Url from "assets/textures/destroy_stage_2.png";
import destroyStage3Url from "assets/textures/destroy_stage_3.png";
import destroyStage4Url from "assets/textures/destroy_stage_4.png";
import destroyStage5Url from "assets/textures/destroy_stage_5.png";
import destroyStage6Url from "assets/textures/destroy_stage_6.png";
import destroyStage7Url from "assets/textures/destroy_stage_7.png";
import destroyStage8Url from "assets/textures/destroy_stage_8.png";
import destroyStage9Url from "assets/textures/destroy_stage_9.png";
import dirtUrl from "assets/textures/dirt.png";
import grassSideUrl from "assets/textures/grass_side.png";
import grassTopUrl from "assets/textures/grass_top.png";
import * as THREE from "three";
import { BlockType } from "engine/chunk/ChunkComponent";
import { applyVertexLighting } from "engine/renderer/applyVertexLighting";

const DESTROY_STAGE_URLS = [
    destroyStage0Url,
    destroyStage1Url,
    destroyStage2Url,
    destroyStage3Url,
    destroyStage4Url,
    destroyStage5Url,
    destroyStage6Url,
    destroyStage7Url,
    destroyStage8Url,
    destroyStage9Url,
];

export const BLOCK_BREAK_STAGE_COUNT = DESTROY_STAGE_URLS.length;

class TextureManager {
    private dirtMat!: THREE.MeshStandardMaterial;
    private grassTopMat!: THREE.MeshStandardMaterial;
    private grassSideMat!: THREE.MeshStandardMaterial;
    private bedrockMat!: THREE.MeshStandardMaterial;
    private destroyStageTextures: THREE.Texture[] = [];

    init() {
        const loader = new THREE.TextureLoader();
        this.dirtMat = this.loadMat(loader, dirtUrl);
        this.grassTopMat = this.loadMat(loader, grassTopUrl);
        this.grassSideMat = this.loadMat(loader, grassSideUrl);
        this.bedrockMat = this.loadMat(loader, bedrockUrl);

        this.destroyStageTextures = DESTROY_STAGE_URLS.map(url => {
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
        if (blockType === BlockType.Bedrock) {
            return this.bedrockMat;
        }
        return this.dirtMat;
    }

    createBlockBreakMaterial(): THREE.MeshBasicMaterial {
        const material = new THREE.MeshBasicMaterial({
            map: this.destroyStageTextures[0],
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
        const texture = this.destroyStageTextures[clamped];
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
