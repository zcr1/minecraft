import type { InventoryItemStack } from "engine/items/InventoryItem";

// Bump whenever the SaveData shape changes incompatibly. load() discards saves whose
// version doesn't match, so the game starts fresh rather than crashing on stale data.
export const SAVE_VERSION = 1;

// One voxel within a chunk that differs from freshly-generated terrain.
// `i` is the chunk-local linear index (x * height * depth + y * depth + z),
// the same packing ChunkComponent.getBlockIndex uses. `t` is the BlockType and
// `m` the blockMeta (torch orientation / water flow distance).
export interface VoxelDelta {
    i: number;
    t: number;
    m: number;
}

// The set of player edits for a single chunk, keyed by chunk coordinates
// (worldOrigin divided by the chunk dimensions).
export interface ChunkDelta {
    cx: number;
    cy: number;
    cz: number;
    voxels: VoxelDelta[];
}

export interface PlayerSave {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    vx: number;
    vy: number;
    vz: number;
    selectedHotbarSlot: number;
    // One entry per inventory slot (length TOTAL_SLOTS); null marks an empty slot.
    slots: ({ item: InventoryItemStack; count: number } | null)[];
}

export interface SaveData {
    version: number;
    seed: number;
    timeOfDay: number;
    player: PlayerSave;
    chunks: ChunkDelta[];
}
