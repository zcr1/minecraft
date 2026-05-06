import * as THREE from "three";

import dirtUrl from "../assets/textures/dirt.png";
import grassSideUrl from "../assets/textures/grass_side.png";
import grassTopUrl from "../assets/textures/grass_top.png";
import { BlockType } from "./components/ChunkComponent";

export default class TextureManager {
    private static _instance: TextureManager | null = null;

    private dirtMat!: THREE.MeshStandardMaterial;
    private grassTopMat!: THREE.MeshStandardMaterial;
    private grassSideMat!: THREE.MeshStandardMaterial;

    private constructor() {}

    static get instance(): TextureManager {
        if (!TextureManager._instance) {
            TextureManager._instance = new TextureManager();
        }
        return TextureManager._instance;
    }

    init() {
        const loader = new THREE.TextureLoader();
        this.dirtMat = this.loadMat(loader, dirtUrl);
        this.grassTopMat = this.loadMat(loader, grassTopUrl);
        this.grassSideMat = this.loadMat(loader, grassSideUrl);
    }

    getMaterial(blockType: BlockType, normalY: number): THREE.Material {
        if (blockType === BlockType.Grass) {
            if (normalY === 1) return this.grassTopMat;
            if (normalY === 0) return this.grassSideMat;
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
