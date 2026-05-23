import { NoiseFunction2D, createNoise2D } from "simplex-noise";
import { BlockType } from "engine/chunk/ChunkComponent";

// Minimal interface for the voxel volume that ore placement needs to read and write.
// Defined here (rather than importing ChunkComponent) to avoid a circular dependency:
// ChunkComponent already imports TerrainGenerator, so the import can only go one way.
export interface ChunkVolume {
    readonly worldOriginX: number;
    readonly worldOriginY: number;
    readonly worldOriginZ: number;
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    getBlock(x: number, y: number, z: number): BlockType;
    setBlock(x: number, y: number, z: number, type: BlockType): void;
}

const COAL_VEINS_PER_CHUNK = 16;
const COAL_VEIN_SIZE = 6;

export type TerrainConfig = {
    seed?: number;
    // Average surface height (world Y) — output of the noise centers here.
    baseHeight: number;
    // Peak-to-trough swing around baseHeight. Surface lands in [baseHeight - amp, baseHeight + amp].
    heightAmplitude: number;
    // Frequency of the lowest octave (e.g. 1/32 means one full wave every 32 blocks).
    // Lower = broader features; higher = noisier surface.
    baseFrequency: number;
    // Number of noise layers summed together for fBm. More octaves = more fine detail.
    octaves: number;
    // Per-octave amplitude multiplier. <1 means higher octaves contribute less (classic value: 0.5).
    persistence: number;
    // Per-octave frequency multiplier. >1 means higher octaves wiggle faster (classic value: 2.0).
    lacunarity: number;
};

// Tiny seeded PRNG. simplex-noise's createNoise2D wants a () => number in [0, 1) to seed
// its permutation table; Math.random is unseeded so we'd lose determinism. mulberry32 is a
// well-known 32-bit-state generator that's a few lines and good enough for terrain.
function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let result = state;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

// ─── Tree generation helpers ──────────────────────────────────────────────────

type TreeBlock = { dx: number; dy: number; dz: number; type: BlockType };
type TreePlacement = { localX: number; localZ: number; variation: 0 | 1 | 2 };

// Returns the full list of blocks that make up a tree, relative to the trunk
// base (dy=0 is the first log above the surface). Trunk blocks always come
// first so that when a log position is later overwritten by a neighbour's leaf
// the log wins (placeTrees processes logs in a second pass).
function getTreeBlocks(variation: 0 | 1 | 2): TreeBlock[] {
    const blocks: TreeBlock[] = [];

    if (variation === 0) {
        // Classic: 4-block trunk, 5×5 lower canopy then 3×3 cap.
        for (let dy = 0; dy < 4; dy++) {
            blocks.push({ dx: 0, dy, dz: 0, type: BlockType.OakLog });
        }
        // dy=3,4: 5×5 minus the 4 diagonal corners.
        // Centre is skipped only at dy=3 where the trunk log already occupies that position.
        // At dy=4 the trunk has ended, so the centre gets a leaf like the rest of the ring.
        for (const dy of [3, 4]) {
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    if (Math.abs(dx) === 2 && Math.abs(dz) === 2) {
                        continue;
                    }
                    if (dx === 0 && dz === 0 && dy === 3) {
                        continue;
                    }
                    blocks.push({ dx, dy, dz, type: BlockType.OakLeaves });
                }
            }
        }
        // dy=5,6: 3×3 full grid (centre is leaves, trunk ends at dy=3).
        for (const dy of [5, 6]) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    blocks.push({ dx, dy, dz, type: BlockType.OakLeaves });
                }
            }
        }
    } else if (variation === 1) {
        // Tall: 6-block trunk, three wide canopy layers then a narrow cap.
        for (let dy = 0; dy < 6; dy++) {
            blocks.push({ dx: 0, dy, dz: 0, type: BlockType.OakLog });
        }
        // dy=5 is the last trunk log; dy=6,7 have no trunk so their centres are leaves.
        for (const dy of [5, 6, 7]) {
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    if (Math.abs(dx) === 2 && Math.abs(dz) === 2) {
                        continue;
                    }
                    if (dx === 0 && dz === 0 && dy === 5) {
                        continue;
                    }
                    blocks.push({ dx, dy, dz, type: BlockType.OakLeaves });
                }
            }
        }
        for (const dy of [8, 9]) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    blocks.push({ dx, dy, dz, type: BlockType.OakLeaves });
                }
            }
        }
    } else {
        // Compact: 4-block trunk, tight canopy with a cross-shaped tip.
        for (let dy = 0; dy < 4; dy++) {
            blocks.push({ dx: 0, dy, dz: 0, type: BlockType.OakLog });
        }
        // dy=3: 5×5 minus corners, skip trunk centre.
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                if (Math.abs(dx) === 2 && Math.abs(dz) === 2) {
                    continue;
                }
                if (dx === 0 && dz === 0) {
                    continue;
                }
                blocks.push({ dx, dy: 3, dz, type: BlockType.OakLeaves });
            }
        }
        // dy=4,5: 3×3 full.
        for (const dy of [4, 5]) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    blocks.push({ dx, dy, dz, type: BlockType.OakLeaves });
                }
            }
        }
        // dy=6: cross tip (centre + 4 cardinal neighbours).
        for (const [dx, dz] of [
            [0, 0],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ] as const) {
            blocks.push({ dx, dy: 6, dz, type: BlockType.OakLeaves });
        }
    }

    return blocks;
}

// seeded pseudo-random number generator (xorshift32)
function getRngFunction(originX: number, originZ: number) {
    // | 1 guarantees a non-zero seed — xorshift32 on 0 always produces 0
    let seed = (Math.imul(originX, 374761393) ^ Math.imul(originZ, 668265263)) | 1;

    return () => {
        // xorshift32 — fast, statistically decent, no dependencies.
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        // >>> 0 coerces to an unsigned 32-bit int, then divide to get [0, 1).
        return (seed >>> 0) / 4294967295;
    };
}

// Returns the deterministic tree positions for one chunk, using the same xorshift32
// PRNG pattern as placeCoalVeins so world generation stays fully seeded.
// 40% chance of no tree, 50% one tree, 10% two trees per chunk.
function getChunkTrees(originX: number, originZ: number, chunkWidth: number, chunkDepth: number): TreePlacement[] {
    const rng = getRngFunction(originX, originZ);

    const roll = rng();
    let treeCount = 0;
    if (roll >= 0.9) {
        treeCount = 4;
    } else if (roll >= 0.5) {
        treeCount = 3;
    } else if (roll >= 0.2) {
        treeCount = 2;
    }

    const trees: TreePlacement[] = [];
    for (let index = 0; index < treeCount; index++) {
        const localX = Math.floor(rng() * chunkWidth);
        const localZ = Math.floor(rng() * chunkDepth);
        const variationRoll = rng();
        const variation: 0 | 1 | 2 = variationRoll < 0.5 ? 0 : variationRoll < 0.85 ? 2 : 1;
        trees.push({ localX, localZ, variation });
    }
    return trees;
}

// ─────────────────────────────────────────────────────────────────────────────

export default class TerrainGenerator {
    private readonly noise2D: NoiseFunction2D;
    private readonly config: TerrainConfig;

    constructor(config: TerrainConfig) {
        this.config = config;
        const prng = mulberry32(config.seed ?? 1);
        this.noise2D = createNoise2D(prng);
    }

    // Fractal Brownian motion (fBm): sum several octaves of noise, each at a higher
    // frequency and lower amplitude than the last. This is what gives terrain both
    // broad shape (low-frequency octaves) and fine detail (high-frequency octaves)
    // from a single underlying noise function.
    getHeight(worldX: number, worldZ: number): number {
        const { baseFrequency, octaves, persistence, lacunarity, baseHeight, heightAmplitude } = this.config;

        let frequency = baseFrequency;
        let amplitude = 1;
        let sum = 0;
        let amplitudeSum = 0;

        for (let octave = 0; octave < octaves; octave++) {
            sum += this.noise2D(worldX * frequency, worldZ * frequency) * amplitude;
            amplitudeSum += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        // Dividing by amplitudeSum normalizes the result back into [-1, 1] regardless
        // of how many octaves we summed, so heightAmplitude maps cleanly to world units.
        const normalized = sum / amplitudeSum;
        return baseHeight + normalized * heightAmplitude;
    }

    // Determines the block type for a voxel that is known to be at or below the surface.
    // Callers that have already computed the surface height (e.g. chunk generation) should
    // use this directly to avoid redundant getHeight() calls.
    blockTypeForLayer(worldY: number, surface: number): BlockType {
        if (worldY === surface) {
            return BlockType.Grass;
        }

        if (worldY >= surface - 3) {
            return BlockType.Dirt;
        }

        return BlockType.Stone;
    }

    getBlock(worldX: number, worldY: number, worldZ: number): BlockType {
        const surface = Math.floor(this.getHeight(worldX, worldZ));

        if (worldY > surface) {
            return BlockType.Air;
        }

        return this.blockTypeForLayer(worldY, surface);
    }

    placeCoalVeins(chunk: ChunkVolume): void {
        // Coal veins are generated with a seeded pseudo-random number generator (xorshift32)
        // so the same chunk coordinates always produce the same ore layout. The seed is derived
        // from the chunk's world origin, making each chunk's result independent from its neighbors.
        const rng = getRngFunction(chunk.worldOriginX, chunk.worldOriginZ);

        // Each vein attempt picks a random starting block anywhere in the chunk and then
        // performs a short random walk, converting stone blocks it lands on into coal ore.
        // Attempts that start in air, dirt, or bedrock simply produce no ore at that step,
        // so veins naturally stay confined to the stone layer without needing extra range checks.
        for (let vein = 0; vein < COAL_VEINS_PER_CHUNK; vein++) {
            let localX = Math.floor(rng() * chunk.width);
            let localY = Math.floor(rng() * (chunk.height - 2)) + 1; // skip y=0 (bedrock layer)
            let localZ = Math.floor(rng() * chunk.depth);

            for (let step = 0; step < COAL_VEIN_SIZE; step++) {
                // Only convert stone — ore can't form in air, dirt, or bedrock.
                const inBounds =
                    localX >= 0 &&
                    localX < chunk.width &&
                    localY >= 0 &&
                    localY < chunk.height &&
                    localZ >= 0 &&
                    localZ < chunk.depth;
                if (inBounds && chunk.getBlock(localX, localY, localZ) === BlockType.Stone) {
                    chunk.setBlock(localX, localY, localZ, BlockType.CoalOre);
                }
                // Advance the walk one block in a random axis-aligned direction (+x, -x, +y, -y, +z, -z).
                // The connected path this traces is what makes the result look like a natural vein
                // rather than scattered individual blocks.
                const direction = Math.floor(rng() * 6);
                if (direction === 0) {
                    localX++;
                } else if (direction === 1) {
                    localX--;
                } else if (direction === 2) {
                    localY++;
                } else if (direction === 3) {
                    localY--;
                } else if (direction === 4) {
                    localZ++;
                } else {
                    localZ--;
                }
            }
        }
    }

    // Places tree blocks for this chunk and all 8 horizontal neighbours so canopy
    // that bleeds across a chunk border is written during the receiving chunk's own
    // generate() call. Blocks are only placed on Air; OakLog may overwrite OakLeaves
    // when two trees from neighbouring chunks happen to overlap.
    placeTrees(chunk: ChunkVolume): void {
        for (let neighborDeltaX = -1; neighborDeltaX <= 1; neighborDeltaX++) {
            for (let neighborDeltaZ = -1; neighborDeltaZ <= 1; neighborDeltaZ++) {
                const neighborOriginX = chunk.worldOriginX + neighborDeltaX * chunk.width;
                const neighborOriginZ = chunk.worldOriginZ + neighborDeltaZ * chunk.depth;
                const trees = getChunkTrees(neighborOriginX, neighborOriginZ, chunk.width, chunk.depth);

                for (const tree of trees) {
                    const worldTreeX = neighborOriginX + tree.localX;
                    const worldTreeZ = neighborOriginZ + tree.localZ;
                    const surface = Math.floor(this.getHeight(worldTreeX, worldTreeZ));
                    const trunkBaseY = surface + 1;

                    for (const treeBlock of getTreeBlocks(tree.variation)) {
                        const worldX = worldTreeX + treeBlock.dx;
                        const worldY = trunkBaseY + treeBlock.dy;
                        const worldZ = worldTreeZ + treeBlock.dz;

                        const localX = worldX - chunk.worldOriginX;
                        const localY = worldY - chunk.worldOriginY;
                        const localZ = worldZ - chunk.worldOriginZ;

                        if (
                            localX < 0 ||
                            localX >= chunk.width ||
                            localY < 0 ||
                            localY >= chunk.height ||
                            localZ < 0 ||
                            localZ >= chunk.depth
                        ) {
                            continue;
                        }

                        const existing = chunk.getBlock(localX, localY, localZ);
                        if (existing !== BlockType.Air) {
                            // Trunk wins over leaves when two trees from adjacent chunks overlap.
                            if (treeBlock.type === BlockType.OakLog && existing === BlockType.OakLeaves) {
                                // fall through and overwrite
                            } else {
                                continue;
                            }
                        }

                        chunk.setBlock(localX, localY, localZ, treeBlock.type);
                    }
                }
            }
        }
    }
}
