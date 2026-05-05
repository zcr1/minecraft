import * as THREE from "three";

import ChunkComponent from "./ChunkComponent";
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
        materials,
        threeScene,
    }: {
        gridWidth: number;
        gridHeight: number;
        gridLayers: number;
        chunkWidth: number;
        chunkHeight: number;
        chunkDepth: number;
        materials: [THREE.Material, THREE.Material];
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
                    chunk.buildMesh(materials[0], materials[1]);
                    threeScene.add(chunk.mesh);
                    grid[x][y][z] = chunk;
                    this.chunks.push(chunk);
                }
            }
        }
    }

    update() {}
}
