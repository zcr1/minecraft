import * as THREE from "three";
import { isPassableBlock } from "engine/chunk/ChunkComponent";
import ChunkManager from "engine/chunk/ChunkManager";

export const SKIN_WIDTH = 1e-4;

export interface PhysicsBody {
    position: { x: number; y: number; z: number };
    velocity: THREE.Vector3;
    halfWidth: number;
    halfHeight: number;
}

export type YCollision = "foot" | "head" | null;

export function applyGravity(body: PhysicsBody, deltaTime: number, gravity: number, terminalVelocity: number): void {
    body.velocity.y = Math.max(body.velocity.y + gravity * deltaTime, terminalVelocity);
}

export function stepAxisY(body: PhysicsBody, chunkManager: ChunkManager, deltaTime: number): YCollision {
    body.position.y += body.velocity.y * deltaTime;

    const { x, y, z } = body.position;
    const minBlockX = Math.ceil(x - body.halfWidth - 0.5);
    const maxBlockX = Math.floor(x + body.halfWidth + 0.5);
    const minBlockZ = Math.ceil(z - body.halfWidth - 0.5);
    const maxBlockZ = Math.floor(z + body.halfWidth + 0.5);

    if (body.velocity.y <= 0) {
        const footBlock = Math.round(y - body.halfHeight);
        for (let blockX = minBlockX; blockX <= maxBlockX; blockX++) {
            for (let blockZ = minBlockZ; blockZ <= maxBlockZ; blockZ++) {
                if (!isPassableBlock(chunkManager.getBlockAtWorld(blockX, footBlock, blockZ))) {
                    body.position.y = footBlock + 0.5 + body.halfHeight + SKIN_WIDTH;
                    return "foot";
                }
            }
        }
    } else {
        const headBlock = Math.round(y + body.halfHeight);
        for (let blockX = minBlockX; blockX <= maxBlockX; blockX++) {
            for (let blockZ = minBlockZ; blockZ <= maxBlockZ; blockZ++) {
                if (!isPassableBlock(chunkManager.getBlockAtWorld(blockX, headBlock, blockZ))) {
                    body.position.y = headBlock - 0.5 - body.halfHeight - SKIN_WIDTH;
                    return "head";
                }
            }
        }
    }
    return null;
}

export function stepAxisX(body: PhysicsBody, chunkManager: ChunkManager, deltaTime: number): boolean {
    body.position.x += body.velocity.x * deltaTime;

    const { x, y, z } = body.position;
    const minBlockY = Math.ceil(y - body.halfHeight - 0.5);
    const maxBlockY = Math.floor(y + body.halfHeight + 0.5);
    const minBlockZ = Math.ceil(z - body.halfWidth - 0.5);
    const maxBlockZ = Math.floor(z + body.halfWidth + 0.5);

    if (body.velocity.x >= 0) {
        const rightBlock = Math.round(x + body.halfWidth);
        for (let blockY = minBlockY; blockY <= maxBlockY; blockY++) {
            for (let blockZ = minBlockZ; blockZ <= maxBlockZ; blockZ++) {
                if (!isPassableBlock(chunkManager.getBlockAtWorld(rightBlock, blockY, blockZ))) {
                    body.position.x = rightBlock - 0.5 - body.halfWidth - SKIN_WIDTH;
                    return true;
                }
            }
        }
    } else {
        const leftBlock = Math.round(x - body.halfWidth);
        for (let blockY = minBlockY; blockY <= maxBlockY; blockY++) {
            for (let blockZ = minBlockZ; blockZ <= maxBlockZ; blockZ++) {
                if (!isPassableBlock(chunkManager.getBlockAtWorld(leftBlock, blockY, blockZ))) {
                    body.position.x = leftBlock + 0.5 + body.halfWidth + SKIN_WIDTH;
                    return true;
                }
            }
        }
    }
    return false;
}

export function stepAxisZ(body: PhysicsBody, chunkManager: ChunkManager, deltaTime: number): boolean {
    body.position.z += body.velocity.z * deltaTime;

    const { x, y, z } = body.position;
    const minBlockY = Math.ceil(y - body.halfHeight - 0.5);
    const maxBlockY = Math.floor(y + body.halfHeight + 0.5);
    const minBlockX = Math.ceil(x - body.halfWidth - 0.5);
    const maxBlockX = Math.floor(x + body.halfWidth + 0.5);

    if (body.velocity.z >= 0) {
        const frontBlock = Math.round(z + body.halfWidth);
        for (let blockY = minBlockY; blockY <= maxBlockY; blockY++) {
            for (let blockX = minBlockX; blockX <= maxBlockX; blockX++) {
                if (!isPassableBlock(chunkManager.getBlockAtWorld(blockX, blockY, frontBlock))) {
                    body.position.z = frontBlock - 0.5 - body.halfWidth - SKIN_WIDTH;
                    return true;
                }
            }
        }
    } else {
        const backBlock = Math.round(z - body.halfWidth);
        for (let blockY = minBlockY; blockY <= maxBlockY; blockY++) {
            for (let blockX = minBlockX; blockX <= maxBlockX; blockX++) {
                if (!isPassableBlock(chunkManager.getBlockAtWorld(blockX, blockY, backBlock))) {
                    body.position.z = backBlock + 0.5 + body.halfWidth + SKIN_WIDTH;
                    return true;
                }
            }
        }
    }
    return false;
}
