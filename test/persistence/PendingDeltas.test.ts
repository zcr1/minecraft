import { BlockType } from "../../src/engine/chunk/ChunkComponent";
import ChunkManager from "../../src/engine/chunk/ChunkManager";
import TerrainGenerator from "../../src/engine/chunk/TerrainGenerator";

jest.mock("../../src/engine/TextureManager", () => {
    const mat = new (require("three").MeshBasicMaterial)();
    return {
        __esModule: true,
        default: {
            init: jest.fn(),
            getMaterial: () => mat,
            getLeavesMaterial: () => mat,
            getWaterMaterial: () => mat,
            getTorchMaterial: () => mat,
            getCraftingTableMaterial: () => mat,
            getFlatItemMaterial: () => mat,
            createBlockBreakMaterial: () => new (require("three").MeshBasicMaterial)(),
            setBlockBreakStage: jest.fn(),
        },
    };
});

jest.mock("../../src/engine/Game", () => {
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

function makeGenerator(): TerrainGenerator {
    return new TerrainGenerator({
        seed: 1,
        baseHeight: 4,
        heightAmplitude: 0,
        baseFrequency: 1 / 8,
        octaves: 1,
        persistence: 0.5,
        lacunarity: 2.0,
        seaLevel: 0,
    });
}

function blockIndex(x: number, y: number, z: number, height: number, depth: number): number {
    return x * height * depth + y * depth + z;
}

function makeManager(initialChunkDeltas?: Parameters<typeof ChunkManager.prototype.loadPendingDeltas>[0]) {
    return new ChunkManager({
        renderRadius: 1,
        worldHeightChunks: 2,
        chunkWidth: 8,
        chunkHeight: 8,
        chunkDepth: 8,
        terrainGenerator: makeGenerator(),
        initialChunkDeltas,
    });
}

describe("ChunkManager pending deltas", () => {
    test("initialChunkDeltas are applied to chunks generated during construction", () => {
        // Local (2,3,4) of chunk (0,0,0) -> world (2,3,4). Pristine terrain there is Dirt.
        const index = blockIndex(2, 3, 4, 8, 8);
        const manager = makeManager([{ cx: 0, cy: 0, cz: 0, voxels: [{ i: index, t: BlockType.OakPlanks, m: 0 }] }]);

        expect(manager.getBlockAtWorld(2, 3, 4)).toBe(BlockType.OakPlanks);
    });

    test("a placed block round-trips through serializeChunks into a new manager", () => {
        const source = makeManager();
        source.setBlockAtWorld(2, 7, 4, BlockType.OakPlanks); // above surface -> was Air

        const chunks = source.serializeChunks();
        expect(chunks.length).toBeGreaterThan(0);

        const restored = makeManager(chunks);
        expect(restored.getBlockAtWorld(2, 7, 4)).toBe(BlockType.OakPlanks);
    });

    test("serializeChunks includes deltas still pending for unloaded chunks (lossless re-save)", () => {
        const manager = makeManager();
        // A chunk far outside the render radius is never generated, so its delta stays pending.
        const index = blockIndex(1, 1, 1, 8, 8);
        manager.loadPendingDeltas([{ cx: 50, cy: 0, cz: 50, voxels: [{ i: index, t: BlockType.Stone, m: 0 }] }]);

        const serialized = manager.serializeChunks();
        const farChunk = serialized.find(chunk => chunk.cx === 50 && chunk.cy === 0 && chunk.cz === 50);
        expect(farChunk).toBeDefined();
        expect(farChunk?.voxels).toEqual([{ i: index, t: BlockType.Stone, m: 0 }]);
    });

    test("consumed deltas are not double-counted: a loaded edited chunk reports via diff, not pending", () => {
        const index = blockIndex(2, 7, 4, 8, 8);
        const manager = makeManager([{ cx: 0, cy: 0, cz: 0, voxels: [{ i: index, t: BlockType.OakPlanks, m: 0 }] }]);

        const serialized = manager.serializeChunks();
        const matching = serialized.filter(chunk => chunk.cx === 0 && chunk.cy === 0 && chunk.cz === 0);
        expect(matching).toHaveLength(1);
        expect(matching[0].voxels).toContainEqual({ i: index, t: BlockType.OakPlanks, m: 0 });
    });
});
