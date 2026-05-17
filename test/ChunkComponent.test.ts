import ChunkComponent, { BlockType } from "../src/engine/chunk/ChunkComponent";

describe("ChunkComponent.hitBlock", () => {
    let chunk: ChunkComponent;

    beforeEach(() => {
        chunk = new ChunkComponent(4, 4, 4, 0, 0, 0);
    });

    test("damage less than hp decrements without breaking", () => {
        chunk.setBlock(1, 1, 1, BlockType.Dirt);
        chunk.hitBlock(1, 1, 1, 1);
        expect(chunk.getBlock(1, 1, 1)).toBe(BlockType.Dirt);
    });

    test("damage equal to hp breaks the block", () => {
        chunk.setBlock(1, 1, 1, BlockType.Dirt);
        chunk.hitBlock(1, 1, 1, 2);
        expect(chunk.getBlock(1, 1, 1)).toBe(BlockType.Air);
    });

    test("damage greater than hp breaks the block without underflow", () => {
        chunk.setBlock(1, 1, 1, BlockType.Dirt);
        chunk.hitBlock(1, 1, 1, 100);
        expect(chunk.getBlock(1, 1, 1)).toBe(BlockType.Air);
    });

    test("accumulated damage across multiple hits breaks the block", () => {
        chunk.setBlock(1, 1, 1, BlockType.Dirt);
        chunk.hitBlock(1, 1, 1, 1);
        expect(chunk.getBlock(1, 1, 1)).toBe(BlockType.Dirt);
        chunk.hitBlock(1, 1, 1, 1);
        expect(chunk.getBlock(1, 1, 1)).toBe(BlockType.Air);
    });

    test("bedrock is indestructible", () => {
        chunk.setBlock(1, 1, 1, BlockType.Bedrock);
        chunk.hitBlock(1, 1, 1, 255);
        expect(chunk.getBlock(1, 1, 1)).toBe(BlockType.Bedrock);
    });

    test("hitting air does nothing", () => {
        chunk.hitBlock(1, 1, 1, 1);
        expect(chunk.getBlock(1, 1, 1)).toBe(BlockType.Air);
    });

    test("out-of-bounds coordinates are ignored", () => {
        chunk.setBlock(0, 0, 0, BlockType.Dirt);
        expect(() => chunk.hitBlock(-1, 0, 0, 1)).not.toThrow();
        expect(() => chunk.hitBlock(0, -1, 0, 1)).not.toThrow();
        expect(() => chunk.hitBlock(0, 0, -1, 1)).not.toThrow();
        expect(() => chunk.hitBlock(4, 0, 0, 1)).not.toThrow();
        expect(() => chunk.hitBlock(0, 4, 0, 1)).not.toThrow();
        expect(() => chunk.hitBlock(0, 0, 4, 1)).not.toThrow();
        expect(chunk.getBlock(0, 0, 0)).toBe(BlockType.Dirt);
    });

    test("setBlock resets hitpoints when overwriting an existing block", () => {
        chunk.setBlock(1, 1, 1, BlockType.Dirt);
        chunk.hitBlock(1, 1, 1, 1);
        chunk.setBlock(1, 1, 1, BlockType.Dirt);
        chunk.hitBlock(1, 1, 1, 1);
        expect(chunk.getBlock(1, 1, 1)).toBe(BlockType.Dirt);
    });

    test("setBlock to Air zeroes hitpoints so re-hitting an air slot is a no-op", () => {
        chunk.setBlock(1, 1, 1, BlockType.Dirt);
        chunk.setBlock(1, 1, 1, BlockType.Air);
        chunk.hitBlock(1, 1, 1, 1);
        expect(chunk.getBlock(1, 1, 1)).toBe(BlockType.Air);
    });
});

describe("ChunkComponent block hitpoints by type", () => {
    test("dirt takes two damage=1 hits to break", () => {
        const chunk = new ChunkComponent(2, 2, 2, 0, 0, 0);
        chunk.setBlock(0, 0, 0, BlockType.Dirt);
        chunk.hitBlock(0, 0, 0, 1);
        expect(chunk.getBlock(0, 0, 0)).toBe(BlockType.Dirt);
        chunk.hitBlock(0, 0, 0, 1);
        expect(chunk.getBlock(0, 0, 0)).toBe(BlockType.Air);
    });

    test("grass takes two damage=1 hits to break", () => {
        const chunk = new ChunkComponent(2, 2, 2, 0, 0, 0);
        chunk.setBlock(0, 0, 0, BlockType.Grass);
        chunk.hitBlock(0, 0, 0, 1);
        expect(chunk.getBlock(0, 0, 0)).toBe(BlockType.Grass);
        chunk.hitBlock(0, 0, 0, 1);
        expect(chunk.getBlock(0, 0, 0)).toBe(BlockType.Air);
    });

    test("bedrock cannot be broken", () => {
        const chunk = new ChunkComponent(2, 2, 2, 0, 0, 0);
        chunk.setBlock(0, 0, 0, BlockType.Bedrock);
        for (let hit = 0; hit < 10; hit++) {
            chunk.hitBlock(0, 0, 0, 1);
        }
        expect(chunk.getBlock(0, 0, 0)).toBe(BlockType.Bedrock);
    });
});
