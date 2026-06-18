import ChunkComponent, { BlockType } from "../src/engine/chunk/ChunkComponent";

describe("ChunkComponent.destroyBlock", () => {
    let chunk: ChunkComponent;

    beforeEach(() => {
        chunk = new ChunkComponent(4, 4, 4, 0, 0, 0);
    });

    test("destroys a destructible block and returns true", () => {
        chunk.setBlock(1, 1, 1, BlockType.Dirt);
        const result = chunk.destroyBlock(1, 1, 1);
        expect(result).toBe(true);
        expect(chunk.getBlock(1, 1, 1)).toBe(BlockType.Air);
    });

    test("returns false and leaves bedrock intact", () => {
        chunk.setBlock(1, 1, 1, BlockType.Bedrock);
        const result = chunk.destroyBlock(1, 1, 1);
        expect(result).toBe(false);
        expect(chunk.getBlock(1, 1, 1)).toBe(BlockType.Bedrock);
    });

    test("returns false on air (no-op)", () => {
        const result = chunk.destroyBlock(1, 1, 1);
        expect(result).toBe(false);
        expect(chunk.getBlock(1, 1, 1)).toBe(BlockType.Air);
    });

    test("out-of-bounds coordinates return false and do not throw", () => {
        chunk.setBlock(0, 0, 0, BlockType.Dirt);
        expect(() => chunk.destroyBlock(-1, 0, 0)).not.toThrow();
        expect(() => chunk.destroyBlock(0, -1, 0)).not.toThrow();
        expect(() => chunk.destroyBlock(0, 0, -1)).not.toThrow();
        expect(() => chunk.destroyBlock(4, 0, 0)).not.toThrow();
        expect(() => chunk.destroyBlock(0, 4, 0)).not.toThrow();
        expect(() => chunk.destroyBlock(0, 0, 4)).not.toThrow();
        expect(chunk.destroyBlock(-1, 0, 0)).toBe(false);
        expect(chunk.getBlock(0, 0, 0)).toBe(BlockType.Dirt);
    });

    test("resets blockMeta to 0 on destroy", () => {
        chunk.setBlock(1, 1, 1, BlockType.Dirt);
        chunk.setBlockMeta(1, 1, 1, 3);
        chunk.destroyBlock(1, 1, 1);
        expect(chunk.getBlockMeta(1, 1, 1)).toBe(0);
    });
});
