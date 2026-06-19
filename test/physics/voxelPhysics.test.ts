import * as THREE from "three";
import { BlockType } from "../../src/engine/block/BlockType";
import type ChunkManager from "../../src/engine/chunk/ChunkManager";
import {
    PhysicsBody,
    SKIN_WIDTH,
    applyGravity,
    stepAxisX,
    stepAxisY,
    stepAxisZ,
} from "../../src/engine/physics/voxelPhysics";

function makeChunkManager(solidBlocks: Set<string>): ChunkManager {
    return {
        getBlockAtWorld(blockX: number, blockY: number, blockZ: number): BlockType {
            return solidBlocks.has(`${blockX},${blockY},${blockZ}`) ? BlockType.Dirt : BlockType.Air;
        },
    } as unknown as ChunkManager;
}

function makeBody(
    position: { x: number; y: number; z: number },
    velocity: { x?: number; y?: number; z?: number },
    halfWidth: number,
    halfHeight: number,
): PhysicsBody {
    return {
        position: { ...position },
        velocity: new THREE.Vector3(velocity.x ?? 0, velocity.y ?? 0, velocity.z ?? 0),
        halfWidth,
        halfHeight,
    };
}

describe("applyGravity", () => {
    test("accumulates downward velocity over time", () => {
        const body = makeBody({ x: 0, y: 0, z: 0 }, {}, 0.15, 0.15);
        applyGravity(body, 0.1, -20, -30);
        expect(body.velocity.y).toBeCloseTo(-2);
        applyGravity(body, 0.1, -20, -30);
        expect(body.velocity.y).toBeCloseTo(-4);
    });

    test("clamps at terminal velocity", () => {
        const body = makeBody({ x: 0, y: 0, z: 0 }, { y: -29.5 }, 0.15, 0.15);
        applyGravity(body, 1.0, -20, -30);
        expect(body.velocity.y).toBe(-30);
    });

    test("does not modify x or z components", () => {
        const body = makeBody({ x: 0, y: 0, z: 0 }, { x: 2, z: -3 }, 0.15, 0.15);
        applyGravity(body, 0.1, -20, -30);
        expect(body.velocity.x).toBe(2);
        expect(body.velocity.z).toBe(-3);
    });
});

describe("stepAxisY", () => {
    test("returns null and advances position in free fall", () => {
        const chunkManager = makeChunkManager(new Set());
        const body = makeBody({ x: 0, y: 10, z: 0 }, { y: -5 }, 0.15, 0.15);
        const result = stepAxisY(body, chunkManager, 0.1);
        expect(result).toBe(null);
        expect(body.position.y).toBeCloseTo(9.5);
    });

    test("returns 'foot' and snaps to block top when landing on a solid block", () => {
        // Block at (0, 0, 0) occupies world Y in [-0.5, 0.5].
        const chunkManager = makeChunkManager(new Set(["0,0,0"]));
        const halfHeight = 0.15;
        const body = makeBody({ x: 0, y: 0.7, z: 0 }, { y: -10 }, 0.15, halfHeight);
        const result = stepAxisY(body, chunkManager, 0.1);
        expect(result).toBe("foot");
        // Foot snap: blockTop (0.5) + halfHeight + SKIN_WIDTH
        expect(body.position.y).toBeCloseTo(0.5 + halfHeight + SKIN_WIDTH);
    });

    test("returns 'head' and snaps below ceiling when jumping into one", () => {
        // Ceiling block at (0, 3, 0) occupies world Y in [2.5, 3.5].
        const chunkManager = makeChunkManager(new Set(["0,3,0"]));
        const halfHeight = 0.9;
        const body = makeBody({ x: 0, y: 1.5, z: 0 }, { y: 10 }, 0.3, halfHeight);
        const result = stepAxisY(body, chunkManager, 0.1);
        expect(result).toBe("head");
        // Head snap: ceilingBottom (2.5) - halfHeight - SKIN_WIDTH
        expect(body.position.y).toBeCloseTo(2.5 - halfHeight - SKIN_WIDTH);
    });
});

describe("stepAxisX", () => {
    test("returns false and advances position in clear air", () => {
        const chunkManager = makeChunkManager(new Set());
        const body = makeBody({ x: 0, y: 0, z: 0 }, { x: 5 }, 0.15, 0.15);
        const result = stepAxisX(body, chunkManager, 0.1);
        expect(result).toBe(false);
        expect(body.position.x).toBeCloseTo(0.5);
    });

    test("returns true and snaps to wall face when moving into a wall (+X)", () => {
        // Wall block at (2, 0, 0) occupies world X in [1.5, 2.5].
        const chunkManager = makeChunkManager(new Set(["2,0,0"]));
        const halfWidth = 0.3;
        const body = makeBody({ x: 1, y: 0, z: 0 }, { x: 10 }, halfWidth, 0.15);
        const result = stepAxisX(body, chunkManager, 0.1);
        expect(result).toBe(true);
        expect(body.position.x).toBeCloseTo(1.5 - halfWidth - SKIN_WIDTH);
    });

    test("returns true and snaps to wall face when moving into a wall (-X)", () => {
        // Wall block at (-2, 0, 0) occupies world X in [-2.5, -1.5].
        const chunkManager = makeChunkManager(new Set(["-2,0,0"]));
        const halfWidth = 0.3;
        const body = makeBody({ x: -1, y: 0, z: 0 }, { x: -10 }, halfWidth, 0.15);
        const result = stepAxisX(body, chunkManager, 0.1);
        expect(result).toBe(true);
        expect(body.position.x).toBeCloseTo(-1.5 + halfWidth + SKIN_WIDTH);
    });
});

describe("stepAxisZ", () => {
    test("returns false and advances position in clear air", () => {
        const chunkManager = makeChunkManager(new Set());
        const body = makeBody({ x: 0, y: 0, z: 0 }, { z: -5 }, 0.15, 0.15);
        const result = stepAxisZ(body, chunkManager, 0.1);
        expect(result).toBe(false);
        expect(body.position.z).toBeCloseTo(-0.5);
    });

    test("returns true and snaps to wall face when moving into a wall (+Z)", () => {
        const chunkManager = makeChunkManager(new Set(["0,0,2"]));
        const halfWidth = 0.3;
        const body = makeBody({ x: 0, y: 0, z: 1 }, { z: 10 }, halfWidth, 0.15);
        const result = stepAxisZ(body, chunkManager, 0.1);
        expect(result).toBe(true);
        expect(body.position.z).toBeCloseTo(1.5 - halfWidth - SKIN_WIDTH);
    });
});

describe("tall AABB perpendicular slice", () => {
    test("stepAxisX catches a wall whose top block is at head height even when the foot block is clear", () => {
        // Player half-height 0.9: with feet at y=0.5 and head at y=2.3,
        // a wall block at (2, 2, 0) (head height) but no block at (2, 1, 0) (foot)
        // must still trigger a collision because the Y-slice spans both block rows.
        const chunkManager = makeChunkManager(new Set(["2,2,0"]));
        const body = makeBody({ x: 1, y: 1.4, z: 0 }, { x: 10 }, 0.3, 0.9);
        const result = stepAxisX(body, chunkManager, 0.1);
        expect(result).toBe(true);
        expect(body.position.x).toBeCloseTo(1.5 - 0.3 - SKIN_WIDTH);
    });
});
