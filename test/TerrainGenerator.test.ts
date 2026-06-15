import { BlockType } from "../src/engine/chunk/ChunkComponent";
import TerrainGenerator, { ChunkVolume, TerrainConfig } from "../src/engine/chunk/TerrainGenerator";

const defaultConfig: TerrainConfig = {
    seed: 42,
    baseHeight: 10,
    heightAmplitude: 5,
    baseFrequency: 1 / 32,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    seaLevel: 0,
};

// Minimal in-memory ChunkVolume for exercising the carve/placement methods without a
// full ChunkComponent (which pulls in Three.js). Defaults every voxel to Stone so caves
// have material to carve; callers can override individual blocks before carving.
class TestVolume implements ChunkVolume {
    readonly width = 16;
    readonly height = 32;
    readonly depth = 16;
    private readonly cells: BlockType[];

    constructor(
        readonly worldOriginX: number,
        readonly worldOriginY: number,
        readonly worldOriginZ: number,
        fill: BlockType = BlockType.Stone,
    ) {
        this.cells = new Array(this.width * this.height * this.depth).fill(fill);
    }

    private index(x: number, y: number, z: number): number {
        return x * this.height * this.depth + y * this.depth + z;
    }

    getBlock(x: number, y: number, z: number): BlockType {
        return this.cells[this.index(x, y, z)];
    }

    setBlock(x: number, y: number, z: number, type: BlockType): void {
        this.cells[this.index(x, y, z)] = type;
    }

    countBlocks(type: BlockType): number {
        let count = 0;
        for (const cell of this.cells) {
            if (cell === type) {
                count++;
            }
        }
        return count;
    }
}

describe("TerrainGenerator", () => {
    test("is deterministic across instances with the same seed", () => {
        const generatorA = new TerrainGenerator(defaultConfig);
        const generatorB = new TerrainGenerator(defaultConfig);

        for (let worldX = -20; worldX <= 20; worldX += 4) {
            for (let worldZ = -20; worldZ <= 20; worldZ += 4) {
                expect(generatorA.getHeight(worldX, worldZ)).toBe(generatorB.getHeight(worldX, worldZ));
            }
        }
    });

    test("different seeds produce different heights", () => {
        const generatorA = new TerrainGenerator({ ...defaultConfig, seed: 1 });
        const generatorB = new TerrainGenerator({ ...defaultConfig, seed: 999 });

        let differences = 0;
        for (let worldX = 0; worldX < 16; worldX++) {
            for (let worldZ = 0; worldZ < 16; worldZ++) {
                if (generatorA.getHeight(worldX, worldZ) !== generatorB.getHeight(worldX, worldZ)) {
                    differences++;
                }
            }
        }
        expect(differences).toBeGreaterThan(0);
    });

    test("heights stay within [baseHeight - amplitude, baseHeight + amplitude]", () => {
        const generator = new TerrainGenerator(defaultConfig);
        const minimum = defaultConfig.baseHeight - defaultConfig.heightAmplitude;
        const maximum = defaultConfig.baseHeight + defaultConfig.heightAmplitude;

        for (let worldX = -100; worldX <= 100; worldX += 3) {
            for (let worldZ = -100; worldZ <= 100; worldZ += 3) {
                const height = generator.getHeight(worldX, worldZ);
                expect(height).toBeGreaterThanOrEqual(minimum);
                expect(height).toBeLessThanOrEqual(maximum);
            }
        }
    });

    test("getBlock layers air above, grass at surface, dirt below", () => {
        const generator = new TerrainGenerator(defaultConfig);
        const worldX = 7;
        const worldZ = 13;
        const surface = Math.floor(generator.getHeight(worldX, worldZ));

        expect(generator.getBlock(worldX, surface + 1, worldZ)).toBe(BlockType.Air);
        expect(generator.getBlock(worldX, surface + 5, worldZ)).toBe(BlockType.Air);
        expect(generator.getBlock(worldX, surface, worldZ)).toBe(BlockType.Grass);
        expect(generator.getBlock(worldX, surface - 1, worldZ)).toBe(BlockType.Dirt);
        expect(generator.getBlock(worldX, surface - 10, worldZ)).toBe(BlockType.Stone);
    });

    test("carveCaves is deterministic for the same seed and chunk origin", () => {
        const generator = new TerrainGenerator(defaultConfig);
        const volumeA = new TestVolume(32, 0, 64);
        const volumeB = new TestVolume(32, 0, 64);

        generator.carveCaves(volumeA);
        generator.carveCaves(volumeB);

        for (let x = 0; x < volumeA.width; x++) {
            for (let y = 0; y < volumeA.height; y++) {
                for (let z = 0; z < volumeA.depth; z++) {
                    expect(volumeA.getBlock(x, y, z)).toBe(volumeB.getBlock(x, y, z));
                }
            }
        }
    });

    test("carveCaves only ever replaces stone with air", () => {
        const generator = new TerrainGenerator({ ...defaultConfig, caveThreshold: 0 });
        const volume = new TestVolume(0, 0, 0);

        // Seed a few non-stone blocks where the noise would otherwise carve.
        volume.setBlock(2, 5, 3, BlockType.Dirt);
        volume.setBlock(4, 8, 7, BlockType.Grass);
        volume.setBlock(9, 12, 1, BlockType.Water);

        generator.carveCaves(volume);

        // Non-stone blocks survive untouched.
        expect(volume.getBlock(2, 5, 3)).toBe(BlockType.Dirt);
        expect(volume.getBlock(4, 8, 7)).toBe(BlockType.Grass);
        expect(volume.getBlock(9, 12, 1)).toBe(BlockType.Water);

        // Every remaining cell is either still stone or carved to air — nothing else appears.
        const stone = volume.countBlocks(BlockType.Stone);
        const air = volume.countBlocks(BlockType.Air);
        expect(stone + air).toBe(volume.width * volume.height * volume.depth - 3);
    });

    test("a high threshold carves nothing; a low threshold carves all stone", () => {
        const dense = new TerrainGenerator({ ...defaultConfig, caveThreshold: -1.1 });
        const carved = new TestVolume(0, 32, 0);
        dense.carveCaves(carved);
        // Noise output never drops below -1, so it always clears a -1.1 threshold: all stone is carved.
        expect(carved.countBlocks(BlockType.Stone)).toBe(0);

        const sparse = new TerrainGenerator({ ...defaultConfig, caveThreshold: 1.1 });
        const untouched = new TestVolume(0, 32, 0);
        sparse.carveCaves(untouched);
        // Noise output never exceeds 1, so it never clears a 1.1 threshold: nothing is carved.
        expect(untouched.countBlocks(BlockType.Air)).toBe(0);
    });

    test("carveCaves leaves the bedrock floor intact", () => {
        // In real generation the y=0 plane is Bedrock, not Stone, so the stone-only check protects
        // it without a dedicated guard. Carve aggressively to confirm bedrock is never replaced.
        const generator = new TerrainGenerator({ ...defaultConfig, caveThreshold: -1.1 });
        const volume = new TestVolume(0, 0, 0);
        for (let x = 0; x < volume.width; x++) {
            for (let z = 0; z < volume.depth; z++) {
                volume.setBlock(x, 0, z, BlockType.Bedrock);
            }
        }

        generator.carveCaves(volume);

        for (let x = 0; x < volume.width; x++) {
            for (let z = 0; z < volume.depth; z++) {
                expect(volume.getBlock(x, 0, z)).toBe(BlockType.Bedrock);
            }
        }
    });
});
