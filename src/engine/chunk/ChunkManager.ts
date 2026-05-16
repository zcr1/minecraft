import * as THREE from "three";
import Component from "../core/Component";
import ChunkComponent, { BlockType } from "./ChunkComponent";
import TerrainGenerator from "./TerrainGenerator";

// todo should this be a singleton?
export default class ChunkManager extends Component {
    private readonly chunks: Map<number, ChunkComponent> = new Map();
    private readonly chunkWidth: number;
    private readonly chunkHeight: number;
    private readonly chunkDepth: number;

    constructor({
        gridWidth,
        gridHeight,
        gridLayers,
        chunkWidth,
        chunkHeight,
        chunkDepth,
        threeScene,
        terrainGenerator,
    }: {
        gridWidth: number;
        gridHeight: number;
        gridLayers: number;
        chunkWidth: number;
        chunkHeight: number;
        chunkDepth: number;
        threeScene: THREE.Scene;
        terrainGenerator: TerrainGenerator;
    }) {
        super();
        this.chunkWidth = chunkWidth;
        this.chunkHeight = chunkHeight;
        this.chunkDepth = chunkDepth;

        for (let chunkX = 0; chunkX < gridWidth; chunkX++) {
            for (let chunkZ = 0; chunkZ < gridHeight; chunkZ++) {
                for (let chunkY = 0; chunkY < gridLayers; chunkY++) {
                    const worldOriginX = chunkX * chunkWidth;
                    const worldOriginY = chunkY * chunkHeight;
                    const worldOriginZ = chunkZ * chunkDepth;

                    const chunk = new ChunkComponent(chunkWidth, chunkHeight, chunkDepth);
                    chunk.mesh.position.set(worldOriginX, worldOriginY, worldOriginZ);
                    chunk.generate(terrainGenerator, worldOriginX, worldOriginY, worldOriginZ);
                    chunk.buildMesh();
                    threeScene.add(chunk.mesh);
                    this.chunks.set(this.getChunkKey(chunkX, chunkY, chunkZ), chunk);
                }
            }
        }
    }

    private getChunkKey(x: number, y: number, z: number) {
        // handles 4,096 chunks in x, 4,096 chunks in y, 256 chunks in z
        return (x & 0xfff) | ((y & 0xfff) << 12) | ((z & 0xff) << 24);
    }

    // Currently only used by DebugClicker
    getChunks(): readonly ChunkComponent[] {
        return [...this.chunks.values()];
    }

    getBlockAtWorld(worldX: number, worldY: number, worldZ: number): BlockType {
        const blockX = Math.round(worldX);
        const blockY = Math.round(worldY);
        const blockZ = Math.round(worldZ);

        const chunkX = Math.floor(blockX / this.chunkWidth);
        const chunkY = Math.floor(blockY / this.chunkHeight);
        const chunkZ = Math.floor(blockZ / this.chunkDepth);

        const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkY, chunkZ));
        if (!chunk) return BlockType.Air;

        const localX = blockX - chunkX * this.chunkWidth;
        const localY = blockY - chunkY * this.chunkHeight;
        const localZ = blockZ - chunkZ * this.chunkDepth;

        return chunk.getBlock(localX, localY, localZ);
    }

    update() {}
}
