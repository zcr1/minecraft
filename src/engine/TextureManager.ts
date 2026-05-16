import * as THREE from "three";
import { BlockType } from "engine/chunk/ChunkComponent";
import bedrockUrl from "../assets/textures/bedrock.png";
import dirtUrl from "../assets/textures/dirt.png";
import grassSideUrl from "../assets/textures/grass_side.png";
import grassTopUrl from "../assets/textures/grass_top.png";

class TextureManager {
    private dirtMat!: THREE.MeshStandardMaterial;
    private grassTopMat!: THREE.MeshStandardMaterial;
    private grassSideMat!: THREE.MeshStandardMaterial;
    private bedrockMat!: THREE.MeshStandardMaterial;

    init() {
        const loader = new THREE.TextureLoader();
        this.dirtMat = this.loadMat(loader, dirtUrl);
        this.grassTopMat = this.loadMat(loader, grassTopUrl);
        this.grassSideMat = this.loadMat(loader, grassSideUrl);
        this.bedrockMat = this.loadMat(loader, bedrockUrl);
    }

    getMaterial(blockType: BlockType, normalY: number): THREE.Material {
        if (blockType === BlockType.Grass) {
            return normalY === 1 ? this.grassTopMat : this.grassSideMat;
        }
        if (blockType === BlockType.Bedrock) {
            return this.bedrockMat;
        }
        return this.dirtMat;
    }

    private loadMat(loader: THREE.TextureLoader, url: string): THREE.MeshStandardMaterial {
        const tex = loader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        return new THREE.MeshStandardMaterial({ map: tex });
    }
}

export default new TextureManager();
