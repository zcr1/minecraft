import { BlockType } from "../src/engine/chunk/ChunkComponent";
import TerrainGenerator, { TerrainConfig } from "../src/engine/chunk/TerrainGenerator";

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
});
