import * as THREE from "three";
import ChunkManager from "../src/engine/chunk/ChunkManager";
import TerrainGenerator from "../src/engine/chunk/TerrainGenerator";

jest.mock("../src/engine/TextureManager", () => {
    // TextureManager.init() is never called in tests so blockMaterials would be
    // undefined. Return a stub that satisfies every call ChunkComponent.buildMesh makes.
    const mat = new (require("three").MeshBasicMaterial)();
    return {
        __esModule: true,
        default: {
            init: jest.fn(),
            getMaterial: () => mat,
            getLeavesMaterial: () => mat,
            getWaterMaterial: () => mat,
            getTorchMaterial: () => mat,
            getFlatItemMaterial: () => mat,
            createBlockBreakMaterial: () => new (require("three").MeshBasicMaterial)(),
            setBlockBreakStage: jest.fn(),
        },
    };
});

jest.mock("../src/engine/Game", () => {
    const transform = { x: 0, y: 0, z: 0 };
    const player = { getComponent: () => transform };
    return {
        __esModule: true,
        default: {
            threeScene: { add: () => {}, remove: () => {} },
            getGameObject: () => player,
        },
    };
});

function makeManager(overrides: { renderRadius?: number; worldHeightChunks?: number } = {}) {
    const terrainGenerator = new TerrainGenerator({
        seed: 1,
        baseHeight: 4,
        heightAmplitude: 0,
        baseFrequency: 1 / 8,
        octaves: 1,
        persistence: 0.5,
        lacunarity: 2.0,
        seaLevel: 0,
    });
    return new ChunkManager({
        renderRadius: overrides.renderRadius ?? 1,
        worldHeightChunks: overrides.worldHeightChunks ?? 2,
        chunkWidth: 8,
        chunkHeight: 8,
        chunkDepth: 8,
        terrainGenerator,
    });
}

describe("ChunkManager.getChunksAlongRay", () => {
    test("returns the chunk containing the origin for a zero-length ray", () => {
        const manager = makeManager();
        const origin = new THREE.Vector3(4, 4, 4);
        const direction = new THREE.Vector3(1, 0, 0);
        const chunks = manager.getChunksAlongRay(origin, direction, 0);
        expect(chunks).toHaveLength(1);
    });

    test("returns multiple chunks when ray crosses a chunk boundary", () => {
        const manager = makeManager();
        // Origin in chunk (0,0,0) heading +X far enough to enter chunk (1,0,0)
        const origin = new THREE.Vector3(4, 4, 4);
        const direction = new THREE.Vector3(1, 0, 0);
        const chunks = manager.getChunksAlongRay(origin, direction, 8);
        expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    test("skips chunkY indices outside the vertical world range", () => {
        const manager = makeManager({ worldHeightChunks: 2 });
        // Downward ray ends below y=0, so the bounding box would include chunkY < 0.
        const origin = new THREE.Vector3(4, 4, 4);
        const direction = new THREE.Vector3(0, -1, 0);
        expect(() => manager.getChunksAlongRay(origin, direction, 100)).not.toThrow();
        const chunks = manager.getChunksAlongRay(origin, direction, 100);
        for (const chunk of chunks) {
            const chunkY = Math.floor(chunk.mesh.position.y / 8);
            expect(chunkY).toBeGreaterThanOrEqual(0);
            expect(chunkY).toBeLessThan(2);
        }
    });

    test("returns an empty array when the ray is outside the generated area", () => {
        const manager = makeManager({ renderRadius: 1 });
        // Far away in +X — well outside any generated chunk
        const origin = new THREE.Vector3(1000, 4, 1000);
        const direction = new THREE.Vector3(1, 0, 0);
        const chunks = manager.getChunksAlongRay(origin, direction, 4);
        expect(chunks).toHaveLength(0);
    });

    test("ray length covers the full traversed distance regardless of direction sign", () => {
        const manager = makeManager({ renderRadius: 1 });
        const forwardOrigin = new THREE.Vector3(4, 4, 4);
        const backwardOrigin = new THREE.Vector3(12, 4, 4);
        const forward = manager.getChunksAlongRay(forwardOrigin, new THREE.Vector3(1, 0, 0), 8);
        const backward = manager.getChunksAlongRay(backwardOrigin, new THREE.Vector3(-1, 0, 0), 8);
        expect(forward.length).toBe(backward.length);
    });
});

describe("ChunkManager.getVisibleChunkColumns", () => {
    test("returns an empty array before the player's chunk column has been established", () => {
        const manager = makeManager({ renderRadius: 1 });
        expect(manager.getVisibleChunkColumns()).toEqual([]);
    });

    test("returns the expected square of generated columns matching renderRadius", () => {
        const manager = makeManager({ renderRadius: 1 });
        manager.update(0);
        const columns = manager.getVisibleChunkColumns();
        // renderRadius=1 around the player's (0,0) column => 3x3 = 9 columns.
        expect(columns).toHaveLength(9);
        for (const column of columns) {
            expect(Math.max(Math.abs(column.chunkX), Math.abs(column.chunkZ))).toBeLessThanOrEqual(1);
            expect(column.worldOriginX).toBe(column.chunkX * 8);
            expect(column.worldOriginZ).toBe(column.chunkZ * 8);
        }
    });
});

describe("ChunkManager.getTerrainColumn", () => {
    test("delegates to TerrainGenerator.getColumn", () => {
        const manager = makeManager();
        const expected = new TerrainGenerator({
            seed: 1,
            baseHeight: 4,
            heightAmplitude: 0,
            baseFrequency: 1 / 8,
            octaves: 1,
            persistence: 0.5,
            lacunarity: 2.0,
            seaLevel: 0,
        }).getColumn(5, 5);
        expect(manager.getTerrainColumn(5, 5)).toEqual(expected);
    });
});
