import ChunkComponent, { BlockType } from "../../src/engine/chunk/ChunkComponent";
import TerrainGenerator from "../../src/engine/chunk/TerrainGenerator";

// Flat, deterministic terrain so diffs reflect only the edits we make.
function makeGenerator(): TerrainGenerator {
    return new TerrainGenerator({
        seed: 42,
        baseHeight: 4,
        heightAmplitude: 0,
        baseFrequency: 1 / 8,
        octaves: 1,
        persistence: 0.5,
        lacunarity: 2.0,
        seaLevel: 0,
    });
}

// Mirror of ChunkComponent.getBlockIndex for asserting delta indices.
function blockIndex(x: number, y: number, z: number, height: number, depth: number): number {
    return x * height * depth + y * depth + z;
}

describe("ChunkComponent.diffAgainstPristine", () => {
    test("a freshly-generated chunk diffs to an empty delta", () => {
        const generator = makeGenerator();
        const chunk = new ChunkComponent(8, 8, 8, 0, 0, 0);
        chunk.generate(generator);
        expect(chunk.diffAgainstPristine(generator)).toEqual([]);
    });

    test("a single edit produces exactly one delta with the correct index, type and meta", () => {
        const generator = makeGenerator();
        const chunk = new ChunkComponent(8, 8, 8, 0, 0, 0);
        chunk.generate(generator);

        chunk.setBlock(2, 3, 4, BlockType.OakPlanks);

        const deltas = chunk.diffAgainstPristine(generator);
        expect(deltas).toHaveLength(1);
        expect(deltas[0]).toEqual({ i: blockIndex(2, 3, 4, 8, 8), t: BlockType.OakPlanks, m: 0 });
    });

    test("captures blockMeta differences (torch orientation)", () => {
        const generator = makeGenerator();
        const chunk = new ChunkComponent(8, 8, 8, 0, 0, 0);
        chunk.generate(generator);

        chunk.setBlock(1, 6, 1, BlockType.Torch);
        chunk.setBlockMeta(1, 6, 1, 2);

        const deltas = chunk.diffAgainstPristine(generator);
        expect(deltas).toHaveLength(1);
        expect(deltas[0]).toEqual({ i: blockIndex(1, 6, 1, 8, 8), t: BlockType.Torch, m: 2 });
    });
});

describe("ChunkComponent.applyDeltas", () => {
    test("round-trips an edited chunk onto a fresh one from the same seed", () => {
        const generator = makeGenerator();

        const original = new ChunkComponent(8, 8, 8, 0, 0, 0);
        original.generate(generator);
        original.setBlock(2, 3, 4, BlockType.OakPlanks);
        original.setBlock(5, 5, 5, BlockType.Air); // dug-out block above the surface stays air
        original.setBlock(1, 6, 1, BlockType.Torch);
        original.setBlockMeta(1, 6, 1, 3);

        const deltas = original.diffAgainstPristine(generator);

        const restored = new ChunkComponent(8, 8, 8, 0, 0, 0);
        restored.generate(generator);
        restored.applyDeltas(deltas);

        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                for (let z = 0; z < 8; z++) {
                    expect(restored.getBlock(x, y, z)).toBe(original.getBlock(x, y, z));
                    expect(restored.getBlockMeta(x, y, z)).toBe(original.getBlockMeta(x, y, z));
                }
            }
        }
    });

    test("a restored solid block can be destroyed normally", () => {
        const generator = makeGenerator();
        const chunk = new ChunkComponent(8, 8, 8, 0, 0, 0);
        chunk.generate(generator);

        // Restore a Stone block into an air cell above the surface.
        chunk.applyDeltas([{ i: blockIndex(0, 7, 0, 8, 8), t: BlockType.Stone, m: 0 }]);
        expect(chunk.getBlock(0, 7, 0)).toBe(BlockType.Stone);

        expect(chunk.destroyBlock(0, 7, 0)).toBe(true);
        expect(chunk.getBlock(0, 7, 0)).toBe(BlockType.Air);
    });

    test("re-diffing after applyDeltas yields the same delta set", () => {
        const generator = makeGenerator();

        const original = new ChunkComponent(8, 8, 8, 0, 0, 0);
        original.generate(generator);
        original.setBlock(2, 3, 4, BlockType.OakPlanks);
        original.setBlock(1, 6, 1, BlockType.Torch);
        original.setBlockMeta(1, 6, 1, 1);
        const deltas = original.diffAgainstPristine(generator);

        const restored = new ChunkComponent(8, 8, 8, 0, 0, 0);
        restored.generate(generator);
        restored.applyDeltas(deltas);

        expect(restored.diffAgainstPristine(generator).sort((a, b) => a.i - b.i)).toEqual(
            deltas.sort((a, b) => a.i - b.i),
        );
    });
});
