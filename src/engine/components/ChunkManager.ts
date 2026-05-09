import * as THREE from "three";

import ChunkComponent, { BlockType } from "./ChunkComponent";
import Component from "../core/Component";

// todo add to common utils
function initialize3dArray(width: number, height: number, depth: number, initialValue = null) {
    const grid = new Array(width);

    for (let i = 0; i < width; i++) {
        grid[i] = new Array(height);

        for (let j = 0; j < depth; j++) {
            grid[i][j] = new Array(depth).fill(initialValue);
        }
    }
    return grid;
}

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
    }: {
        gridWidth: number;
        gridHeight: number;
        gridLayers: number;
        chunkWidth: number;
        chunkHeight: number;
        chunkDepth: number;
        threeScene: THREE.Scene;
    }) {
        super();
        this.chunkWidth = chunkWidth;
        this.chunkHeight = chunkHeight;
        this.chunkDepth = chunkDepth;

        // 3D grid indexed [x][y][z] — generate top-to-bottom so chunkAbove is always ready
        const grid: ChunkComponent[][][] = initialize3dArray(gridWidth, gridHeight, gridLayers);

        for (let x = 0; x < gridWidth; x++) {
            for (let z = 0; z < gridHeight; z++) {
                for (let y = gridLayers - 1; y >= 0; y--) {
                    const chunk = new ChunkComponent(chunkWidth, chunkHeight, chunkDepth);
                    chunk.mesh.position.set(x * chunkWidth, y * chunkHeight, z * chunkDepth);
                    chunk.generate(y < gridLayers - 1 ? grid[x][y + 1][z] : undefined);
                    chunk.buildMesh();
                    threeScene.add(chunk.mesh);
                    grid[x][y][z] = chunk;
                    this.chunks.set(this.getChunkKey(x, y, z), chunk);
                }
            }
        }
    }

    private getChunkKey(x: number, y: number, z: number) {
        // handles 4,096 chunks in x, 4,096 chunks in y, 256 chunks in z
        return (x & 0xfff) | ((y & 0xfff) << 12) | ((z & 0xff) << 24);
    }

    getChunks(): readonly ChunkComponent[] {
        // Currently only used by DebugClicker
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

        const lx = blockX - chunkX * this.chunkWidth;
        const ly = blockY - chunkY * this.chunkHeight;
        const lz = blockZ - chunkZ * this.chunkDepth;

        return chunk.getBlock(lx, ly, lz);
    }

    update() {}
}
