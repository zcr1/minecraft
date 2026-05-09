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
    private readonly chunks: ChunkComponent[] = [];

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
                    this.chunks.push(chunk);
                }
            }
        }
    }

    getChunks(): readonly ChunkComponent[] {
        return this.chunks;
    }

    getBlockAtWorld(wx: number, wy: number, wz: number): BlockType {
        const bx = Math.round(wx);
        const by = Math.round(wy);
        const bz = Math.round(wz);

        for (const chunk of this.chunks) {
            const lx = bx - chunk.mesh.position.x;
            const ly = by - chunk.mesh.position.y;
            const lz = bz - chunk.mesh.position.z;
            if (lx >= 0 && lx < chunk.width && ly >= 0 && ly < chunk.height && lz >= 0 && lz < chunk.depth) {
                return chunk.getBlock(lx, ly, lz);
            }
        }
        return BlockType.Air;
    }

    update() {}
}
