import { BlockType } from "./ChunkComponent";
import type ChunkComponent from "./ChunkComponent";
import type ChunkManager from "./ChunkManager";

// 4-bit max so sky+block light can later be packed into one byte (high nibble = sky, low = block).
export const MAX_LIGHT = 15;

// Torches emit block light at level 14, leaving one step of falloff right at the source.
export const TORCH_LIGHT_LEVEL = 14;

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
];

class LightingSystem {
    // OakLeaves are transparent to the BFS propagation passes (seedFromNeighbors,
    // propagate) so light spreads through canopy at –1 per hop. The top-down column
    // seed (seedTopDown) intentionally uses a stricter Air-only check so the column
    // seed breaks when it hits the first leaf layer — without that, full sky-light (15)
    // would flood straight through the canopy and the ground below would look identical
    // to open sky. With the column seed blocked, the only path for light under the
    // canopy is BFS: each leaf layer costs one level, so a 3–4 block deep canopy drops
    // ground light to ~11–12, which is visibly darker.
    private isLightTransparent(blockType: BlockType): boolean {
        return (
            blockType === BlockType.Air ||
            blockType === BlockType.OakLeaves ||
            blockType === BlockType.Torch ||
            blockType === BlockType.Water
        );
    }

    // Three-pass BFS:
    //   1. Top-down column seed - air voxels inherit the light value from the voxel one above
    //      the chunk (open sky returns 15; a partially-obstructed column above returns less).
    //      Inheritance passes down through air without decrement, matching Minecraft's
    //      "skylight falls straight down" rule. This is what makes deep surface tunnels dim
    //      below an obstruction in the chunk above instead of resetting to full brightness.
    //   2. Neighbor seed - pull in light from already-lit neighbor chunks so cross-chunk gradients
    //      are continuous (no seam at chunk borders).
    //   3. Propagate - standard flood fill, -1 per step into air, scoped to this chunk's array.
    // We never write into neighbor chunks: those will run their own recompute when needed.
    recomputeSkyLight(chunk: ChunkComponent, chunkManager: ChunkManager): void {
        chunk.clearSkyLight();

        const queue: number[] = [];

        this.seedTopDown(chunk, chunkManager, queue);
        this.seedFromNeighbors(chunk, chunkManager, queue);
        this.propagate(chunk, queue);
    }

    private seedTopDown(chunk: ChunkComponent, chunkManager: ChunkManager, queue: number[]): void {
        const { width, height, depth, worldOriginX, worldOriginY, worldOriginZ } = chunk;
        for (let localX = 0; localX < width; localX++) {
            for (let localZ = 0; localZ < depth; localZ++) {
                // Sample the voxel one above this chunk's top. Above the world cap this is
                // MAX_LIGHT (open sky); for a lower chunk it's whatever the upper chunk had at
                // its bottom row in this column - which correctly accounts for any solid blocks
                // between us and the sky.
                const incomingLight = chunkManager.getLightAtWorld(
                    worldOriginX + localX,
                    worldOriginY + height,
                    worldOriginZ + localZ,
                );
                if (incomingLight <= 0) {
                    continue;
                }
                for (let localY = height - 1; localY >= 0; localY--) {
                    // Strict air-only check: leaves block the direct column seed so the
                    // canopy casts a real shadow. BFS (seedFromNeighbors + propagate) then
                    // spreads light through the leaves at –1 per hop, giving natural dimming.
                    if (chunk.getBlock(localX, localY, localZ) !== BlockType.Air) {
                        break;
                    }
                    if (chunk.getSkyLight(localX, localY, localZ) >= incomingLight) {
                        continue;
                    }
                    chunk.setSkyLight(localX, localY, localZ, incomingLight);
                    queue.push(this.packLocal(localX, localY, localZ, height, depth));
                }
            }
        }
    }

    private seedFromNeighbors(chunk: ChunkComponent, chunkManager: ChunkManager, queue: number[]): void {
        const { width, height, depth, worldOriginX, worldOriginY, worldOriginZ } = chunk;

        // For each of the 6 faces, walk only the 2D slab of voxels on that face (not the full
        // volume) and sample the one neighbor across the face. The start/end pinning collapses
        // the loop on whichever axis the face's offset is non-zero.
        for (const [offsetX, offsetY, offsetZ] of NEIGHBOR_OFFSETS) {
            const startX = offsetX === 1 ? width - 1 : 0;
            const endX = offsetX === -1 ? 0 : width - 1;
            const startY = offsetY === 1 ? height - 1 : 0;
            const endY = offsetY === -1 ? 0 : height - 1;
            const startZ = offsetZ === 1 ? depth - 1 : 0;
            const endZ = offsetZ === -1 ? 0 : depth - 1;

            for (let localX = startX; localX <= endX; localX++) {
                for (let localY = startY; localY <= endY; localY++) {
                    for (let localZ = startZ; localZ <= endZ; localZ++) {
                        if (!this.isLightTransparent(chunk.getBlock(localX, localY, localZ))) {
                            continue;
                        }

                        const neighborLight = chunkManager.getLightAtWorld(
                            worldOriginX + localX + offsetX,
                            worldOriginY + localY + offsetY,
                            worldOriginZ + localZ + offsetZ,
                        );
                        const seeded = neighborLight - 1;
                        if (seeded <= 0) {
                            continue;
                        }
                        if (seeded <= chunk.getSkyLight(localX, localY, localZ)) {
                            continue;
                        }

                        chunk.setSkyLight(localX, localY, localZ, seeded);
                        queue.push(this.packLocal(localX, localY, localZ, height, depth));
                    }
                }
            }
        }
    }

    private propagate(chunk: ChunkComponent, queue: number[]): void {
        const { width, height, depth } = chunk;

        // Cursor walk instead of Array.shift to keep this O(n): shift is O(n) per call on
        // typical JS engines, which would make the BFS O(n^2) for a chunk-sized queue.
        let cursor = 0;
        while (cursor < queue.length) {
            const packed = queue[cursor++];
            const localX = Math.floor(packed / (height * depth));
            const remainder = packed - localX * height * depth;
            const localY = Math.floor(remainder / depth);
            const localZ = remainder - localY * depth;

            const level = chunk.getSkyLight(localX, localY, localZ);
            if (level <= 1) {
                continue;
            }
            const propagated = level - 1;

            for (const [deltaX, deltaY, deltaZ] of NEIGHBOR_OFFSETS) {
                const nextX = localX + deltaX;
                const nextY = localY + deltaY;
                const nextZ = localZ + deltaZ;

                if (nextX < 0 || nextX >= width) {
                    continue;
                }
                if (nextY < 0 || nextY >= height) {
                    continue;
                }
                if (nextZ < 0 || nextZ >= depth) {
                    continue;
                }
                if (!this.isLightTransparent(chunk.getBlock(nextX, nextY, nextZ))) {
                    continue;
                }
                if (chunk.getSkyLight(nextX, nextY, nextZ) >= propagated) {
                    continue;
                }

                chunk.setSkyLight(nextX, nextY, nextZ, propagated);
                queue.push(this.packLocal(nextX, nextY, nextZ, height, depth));
            }
        }
    }

    // Mirrors recomputeSkyLight but propagates emitted block light from torch blocks instead
    // of sky. Clears only the block-light nibble first so sky light is preserved.
    recomputeBlockLight(chunk: ChunkComponent, chunkManager: ChunkManager): void {
        chunk.clearBlockLight();

        const queue: number[] = [];

        this.seedTorchEmitters(chunk, queue);
        this.seedBlockLightFromNeighbors(chunk, chunkManager, queue);
        this.propagateBlockLight(chunk, queue);
    }

    // Seed block light from any torch blocks inside this chunk.
    private seedTorchEmitters(chunk: ChunkComponent, queue: number[]): void {
        const { width, height, depth } = chunk;
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                for (let z = 0; z < depth; z++) {
                    if (chunk.getBlock(x, y, z) === BlockType.Torch) {
                        chunk.setBlockLight(x, y, z, TORCH_LIGHT_LEVEL);
                        queue.push(this.packLocal(x, y, z, height, depth));
                    }
                }
            }
        }
    }

    // Seed block light from the faces of already-lit neighbor chunks so cross-chunk gradients
    // are continuous (same slab-walk pattern as seedFromNeighbors for sky light).
    private seedBlockLightFromNeighbors(chunk: ChunkComponent, chunkManager: ChunkManager, queue: number[]): void {
        const { width, height, depth, worldOriginX, worldOriginY, worldOriginZ } = chunk;

        for (const [offsetX, offsetY, offsetZ] of NEIGHBOR_OFFSETS) {
            const startX = offsetX === 1 ? width - 1 : 0;
            const endX = offsetX === -1 ? 0 : width - 1;
            const startY = offsetY === 1 ? height - 1 : 0;
            const endY = offsetY === -1 ? 0 : height - 1;
            const startZ = offsetZ === 1 ? depth - 1 : 0;
            const endZ = offsetZ === -1 ? 0 : depth - 1;

            for (let localX = startX; localX <= endX; localX++) {
                for (let localY = startY; localY <= endY; localY++) {
                    for (let localZ = startZ; localZ <= endZ; localZ++) {
                        if (!this.isLightTransparent(chunk.getBlock(localX, localY, localZ))) {
                            continue;
                        }

                        const neighborBlockLight = chunkManager.getBlockLightAtWorld(
                            worldOriginX + localX + offsetX,
                            worldOriginY + localY + offsetY,
                            worldOriginZ + localZ + offsetZ,
                        );
                        const seeded = neighborBlockLight - 1;
                        if (seeded <= 0) {
                            continue;
                        }
                        if (seeded <= chunk.getBlockLight(localX, localY, localZ)) {
                            continue;
                        }

                        chunk.setBlockLight(localX, localY, localZ, seeded);
                        queue.push(this.packLocal(localX, localY, localZ, height, depth));
                    }
                }
            }
        }
    }

    // BFS flood fill for block light — identical logic to propagate() but using the block-light
    // nibble accessors instead of the sky-light ones.
    private propagateBlockLight(chunk: ChunkComponent, queue: number[]): void {
        const { width, height, depth } = chunk;

        let cursor = 0;
        while (cursor < queue.length) {
            const packed = queue[cursor++];
            const localX = Math.floor(packed / (height * depth));
            const remainder = packed - localX * height * depth;
            const localY = Math.floor(remainder / depth);
            const localZ = remainder - localY * depth;

            const level = chunk.getBlockLight(localX, localY, localZ);
            if (level <= 1) {
                continue;
            }
            const propagated = level - 1;

            for (const [deltaX, deltaY, deltaZ] of NEIGHBOR_OFFSETS) {
                const nextX = localX + deltaX;
                const nextY = localY + deltaY;
                const nextZ = localZ + deltaZ;

                if (nextX < 0 || nextX >= width) {
                    continue;
                }
                if (nextY < 0 || nextY >= height) {
                    continue;
                }
                if (nextZ < 0 || nextZ >= depth) {
                    continue;
                }
                if (!this.isLightTransparent(chunk.getBlock(nextX, nextY, nextZ))) {
                    continue;
                }
                if (chunk.getBlockLight(nextX, nextY, nextZ) >= propagated) {
                    continue;
                }

                chunk.setBlockLight(nextX, nextY, nextZ, propagated);
                queue.push(this.packLocal(nextX, nextY, nextZ, height, depth));
            }
        }
    }

    private packLocal(localX: number, localY: number, localZ: number, height: number, depth: number): number {
        return localX * height * depth + localY * depth + localZ;
    }
}

export default new LightingSystem();
