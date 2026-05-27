import * as THREE from "three";
import game from "../Game";
import Transform from "../components/Transform";
import Component from "../core/Component";
import GameObjectName from "../utils/gameObjectNames";
import ChunkComponent, { BlockType, TORCH_ATTACHMENT_OFFSETS } from "./ChunkComponent";
import lightingSystem, { MAX_LIGHT } from "./LightingSystem";
import TerrainGenerator from "./TerrainGenerator";

const GENERATION_BUDGET_PER_FRAME = 2;
const WATER_TICK_INTERVAL = 1.0;
const MAX_WATER_FLOW_DISTANCE = 7;

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
];

const WATER_HORIZONTAL_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
];

export default class ChunkManager extends Component {
    private readonly chunks: Map<number, ChunkComponent> = new Map();
    private readonly chunkWidth: number;
    private readonly chunkHeight: number;
    private readonly chunkDepth: number;
    private readonly worldHeightChunks: number;
    private readonly terrainGenerator: TerrainGenerator;
    private readonly renderRadius: number;
    private playerTransform: Transform | null = null;
    private previousCenterX: number | null = null;
    private previousCenterZ: number | null = null;
    private readonly pendingWaterUpdates = new Map<number, { worldX: number; worldY: number; worldZ: number }>();
    private waterTickAccumulator = 0;

    constructor({
        renderRadius,
        worldHeightChunks,
        chunkWidth,
        chunkHeight,
        chunkDepth,
        terrainGenerator,
    }: {
        renderRadius: number;
        worldHeightChunks: number;
        chunkWidth: number;
        chunkHeight: number;
        chunkDepth: number;
        terrainGenerator: TerrainGenerator;
    }) {
        super();
        this.renderRadius = renderRadius;
        this.worldHeightChunks = worldHeightChunks;
        this.chunkWidth = chunkWidth;
        this.chunkHeight = chunkHeight;
        this.chunkDepth = chunkDepth;
        this.terrainGenerator = terrainGenerator;

        this.generateInitialChunks();
    }

    // Converts a floating-point world position to the chunk that owns it plus the block-local
    // coordinates within that chunk. Returns null if the position is vertically out of range or
    // the owning chunk hasn't been loaded yet
    private resolveWorldBlock(
        worldX: number,
        worldY: number,
        worldZ: number,
    ): { chunk: ChunkComponent; localX: number; localY: number; localZ: number } | null {
        const blockX = Math.round(worldX);
        const blockY = Math.round(worldY);
        const blockZ = Math.round(worldZ);
        const chunkX = Math.floor(blockX / this.chunkWidth);
        const chunkY = Math.floor(blockY / this.chunkHeight);
        const chunkZ = Math.floor(blockZ / this.chunkDepth);
        if (chunkY < 0 || chunkY >= this.worldHeightChunks) {
            return null;
        }
        const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkY, chunkZ));
        if (!chunk) {
            return null;
        }
        return {
            chunk,
            localX: blockX - chunkX * this.chunkWidth,
            localY: blockY - chunkY * this.chunkHeight,
            localZ: blockZ - chunkZ * this.chunkDepth,
        };
    }

    private getPlayerTransform(): Transform {
        this.playerTransform ??= game.getGameObject(GameObjectName.Player).getComponent(Transform);
        return this.playerTransform;
    }

    private getChunkKey(x: number, y: number, z: number) {
        // Pack (x, y, z) into a single 32-bit int so the Map can use a primitive key. X and Z are
        // biased into a non-negative range before masking so negative coordinates don't collide
        // with large positive ones (-1 & 0xfff === 4095, same key as x=4095 without the bias).
        // Layout: x in bits 0-11 (+-2048 chunks), z in bits 12-23 (±2048 chunks), y in bits 24-31
        // (8 bits reserved, but y is functionally bounded by worldHeightChunks). At chunkWidth=8
        // that's +-16,384 blocks horizontally - well beyond any plausible play area; we can pick
        // larger biases if the world ever needs to grow past that.
        if (x < -0x800 || x >= 0x800 || z < -0x800 || z >= 0x800 || y < 0 || y >= this.worldHeightChunks) {
            // Out-of-range coords silently wrap and collide with valid chunks
            throw new Error(`Chunk coordinate out of range: (${x}, ${y}, ${z})`);
        }

        return ((x + 0x800) & 0xfff) | (((z + 0x800) & 0xfff) << 12) | ((y & 0xff) << 24);
    }

    private getPlayerChunkColumn(): { chunkX: number; chunkZ: number } {
        const playerTransform = this.getPlayerTransform();
        return {
            chunkX: Math.floor(playerTransform.x / this.chunkWidth),
            chunkZ: Math.floor(playerTransform.z / this.chunkDepth),
        };
    }

    private getOrCreateChunk(chunkX: number, chunkY: number, chunkZ: number): ChunkComponent {
        const key = this.getChunkKey(chunkX, chunkY, chunkZ);
        const existing = this.chunks.get(key);
        if (existing) {
            return existing;
        }

        const worldOriginX = chunkX * this.chunkWidth;
        const worldOriginY = chunkY * this.chunkHeight;
        const worldOriginZ = chunkZ * this.chunkDepth;

        const chunk = new ChunkComponent(
            this.chunkWidth,
            this.chunkHeight,
            this.chunkDepth,
            worldOriginX,
            worldOriginY,
            worldOriginZ,
        );
        chunk.mesh.position.set(worldOriginX, worldOriginY, worldOriginZ);
        chunk.generate(this.terrainGenerator);
        lightingSystem.recomputeSkyLight(chunk, this);
        lightingSystem.recomputeBlockLight(chunk, this);
        chunk.buildMesh(this);
        game.threeScene.add(chunk.mesh);
        this.chunks.set(key, chunk);

        // Already-loaded neighbors were lit against an "unloaded" version of this chunk (treated
        // as opaque by getLightAtWorld), so their edge cells may have the wrong light. Relight
        // them now that the real chunk exists - this is what hides streaming seams.
        this.relightLoadedNeighbors(chunkX, chunkY, chunkZ);

        return chunk;
    }

    private relightAndRebuild(chunk: ChunkComponent): void {
        lightingSystem.recomputeSkyLight(chunk, this);
        lightingSystem.recomputeBlockLight(chunk, this);
        chunk.rebuild(this);
    }

    private relightLoadedNeighbors(chunkX: number, chunkY: number, chunkZ: number): void {
        for (const [offsetX, offsetY, offsetZ] of NEIGHBOR_OFFSETS) {
            const neighborChunkX = chunkX + offsetX;
            const neighborChunkY = chunkY + offsetY;
            const neighborChunkZ = chunkZ + offsetZ;
            if (neighborChunkY < 0 || neighborChunkY >= this.worldHeightChunks) {
                continue;
            }
            const neighbor = this.chunks.get(this.getChunkKey(neighborChunkX, neighborChunkY, neighborChunkZ));
            if (!neighbor) {
                continue;
            }
            this.relightAndRebuild(neighbor);
        }
    }

    // Relight the given chunk then all 6 face-adjacent loaded neighbors. Called after any block
    // placement or removal so both sky and block light stay consistent across chunk boundaries.
    //
    // Two-hop propagation is not needed: with chunkWidth=16 and TORCH_LIGHT_LEVEL=14 a torch
    // placed at the very edge of a chunk illuminates at most 13 blocks into the neighbor, which
    // is within one chunk width — so relighting the immediate neighbors is always sufficient.
    //
    // Ordering matters: the chunk itself is rebuilt first so the neighbor edge-seed pass
    // (seedBlockLightFromNeighbors / seedFromNeighbors) reads the already-updated block light
    // when it samples across the shared face.
    relightAround(chunk: ChunkComponent): void {
        this.relightAndRebuild(chunk);
        const chunkX = Math.floor(chunk.worldOriginX / this.chunkWidth);
        const chunkY = Math.floor(chunk.worldOriginY / this.chunkHeight);
        const chunkZ = Math.floor(chunk.worldOriginZ / this.chunkDepth);
        this.relightLoadedNeighbors(chunkX, chunkY, chunkZ);
    }

    getLightAtWorld(worldX: number, worldY: number, worldZ: number): number {
        // Above the world's vertical cap is open sky (full skylight); below the world is treated
        // as opaque underground (0). Unloaded chunks inside the cap fall through to the !chunk
        // branch below and also return 0 - the streaming relight in getOrCreateChunk corrects
        // any seams that creates.
        const chunkY = Math.floor(Math.round(worldY) / this.chunkHeight);
        if (chunkY >= this.worldHeightChunks) {
            return MAX_LIGHT;
        }
        const resolved = this.resolveWorldBlock(worldX, worldY, worldZ);
        if (!resolved) {
            return 0;
        }
        return Math.max(
            resolved.chunk.getSkyLight(resolved.localX, resolved.localY, resolved.localZ),
            resolved.chunk.getBlockLight(resolved.localX, resolved.localY, resolved.localZ),
        );
    }

    // Returns only the block-light nibble for the given world position.
    // Used by LightingSystem.seedBlockLightFromNeighbors to seed cross-chunk block light.
    getBlockLightAtWorld(worldX: number, worldY: number, worldZ: number): number {
        const resolved = this.resolveWorldBlock(worldX, worldY, worldZ);
        if (!resolved) {
            return 0;
        }
        return resolved.chunk.getBlockLight(resolved.localX, resolved.localY, resolved.localZ);
    }

    private generateInitialChunks(): void {
        const { chunkX: centerX, chunkZ: centerZ } = this.getPlayerChunkColumn();
        for (let deltaX = -this.renderRadius; deltaX <= this.renderRadius; deltaX++) {
            for (let deltaZ = -this.renderRadius; deltaZ <= this.renderRadius; deltaZ++) {
                for (let chunkY = 0; chunkY < this.worldHeightChunks; chunkY++) {
                    this.getOrCreateChunk(centerX + deltaX, chunkY, centerZ + deltaZ);
                }
            }
        }
    }

    private reconcileVisibility(centerX: number, centerZ: number): void {
        // Hide chunks that sat inside the previous radius but fell outside the new one.
        if (this.previousCenterX !== null && this.previousCenterZ !== null) {
            for (let deltaX = -this.renderRadius; deltaX <= this.renderRadius; deltaX++) {
                for (let deltaZ = -this.renderRadius; deltaZ <= this.renderRadius; deltaZ++) {
                    const oldChunkX = this.previousCenterX + deltaX;
                    const oldChunkZ = this.previousCenterZ + deltaZ;

                    const horizontalDistance = Math.max(Math.abs(oldChunkX - centerX), Math.abs(oldChunkZ - centerZ));
                    if (horizontalDistance <= this.renderRadius) {
                        continue;
                    }

                    for (let chunkY = 0; chunkY < this.worldHeightChunks; chunkY++) {
                        const chunk = this.chunks.get(this.getChunkKey(oldChunkX, chunkY, oldChunkZ));
                        if (chunk) {
                            chunk.mesh.visible = false;
                        }
                    }
                }
            }
        }

        // Show chunks inside the new radius. Newly-generated chunks default to visible, so this
        // pass only matters for chunks that were hidden by a previous reconcile and have now
        // re-entered range.
        for (let deltaX = -this.renderRadius; deltaX <= this.renderRadius; deltaX++) {
            for (let deltaZ = -this.renderRadius; deltaZ <= this.renderRadius; deltaZ++) {
                const chunkX = centerX + deltaX;
                const chunkZ = centerZ + deltaZ;

                for (let chunkY = 0; chunkY < this.worldHeightChunks; chunkY++) {
                    const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkY, chunkZ));
                    if (chunk) {
                        chunk.mesh.visible = true;
                    }
                }
            }
        }
    }

    private updateLoadedChunks(): void {
        const { chunkX: centerX, chunkZ: centerZ } = this.getPlayerChunkColumn();

        // Visibility only needs reconciling when the player crosses a chunk boundary; on stationary
        // frames the previous-frame state is still correct. Hidden chunks stay in the Map so
        // re-entry is a free toggle (no regeneration) and getBlockAtWorld still resolves collision
        // for chunks just past the render edge.
        if (centerX !== this.previousCenterX || centerZ !== this.previousCenterZ) {
            this.reconcileVisibility(centerX, centerZ);
            this.previousCenterX = centerX;
            this.previousCenterZ = centerZ;
        }

        // Collect every column inside the radius that hasn't been generated yet.
        const pending: { chunkX: number; chunkY: number; chunkZ: number; distanceSquared: number }[] = [];

        for (let deltaX = -this.renderRadius; deltaX <= this.renderRadius; deltaX++) {
            for (let deltaZ = -this.renderRadius; deltaZ <= this.renderRadius; deltaZ++) {
                for (let chunkY = 0; chunkY < this.worldHeightChunks; chunkY++) {
                    const chunkX = centerX + deltaX;
                    const chunkZ = centerZ + deltaZ;

                    if (this.chunks.has(this.getChunkKey(chunkX, chunkY, chunkZ))) {
                        continue;
                    }

                    pending.push({
                        chunkX,
                        chunkY,
                        chunkZ,
                        distanceSquared: deltaX * deltaX + deltaZ * deltaZ,
                    });
                }
            }
        }

        if (pending.length === 0) {
            return;
        }

        // Sort nearest-first so the per-frame budget is spent on chunks the player is about to see.
        // Without this, raw iteration order would generate the radius corners before the chunk
        // directly in front of the player, leaving a visible gap when walking forward.
        pending.sort((a, b) => a.distanceSquared - b.distanceSquared);

        // Cap work per frame to avoid hitches; remaining chunks fill in on subsequent frames.
        const limit = Math.min(GENERATION_BUDGET_PER_FRAME, pending.length);
        for (let i = 0; i < limit; i++) {
            const { chunkX, chunkY, chunkZ } = pending[i];
            this.getOrCreateChunk(chunkX, chunkY, chunkZ);
        }
    }

    update(deltaTime: number) {
        this.updateLoadedChunks();
        this.waterTickAccumulator += deltaTime;
        if (this.waterTickAccumulator >= WATER_TICK_INTERVAL) {
            this.waterTickAccumulator = 0;
            this.tickWater();
        }
    }

    getChunksAlongRay(origin: THREE.Vector3, direction: THREE.Vector3, distance: number): ChunkComponent[] {
        const endX = origin.x + direction.x * distance;
        const endY = origin.y + direction.y * distance;
        const endZ = origin.z + direction.z * distance;

        const minChunkX = Math.floor(Math.min(origin.x, endX) / this.chunkWidth);
        const maxChunkX = Math.floor(Math.max(origin.x, endX) / this.chunkWidth);
        const minChunkY = Math.floor(Math.min(origin.y, endY) / this.chunkHeight);
        const maxChunkY = Math.floor(Math.max(origin.y, endY) / this.chunkHeight);
        const minChunkZ = Math.floor(Math.min(origin.z, endZ) / this.chunkDepth);
        const maxChunkZ = Math.floor(Math.max(origin.z, endZ) / this.chunkDepth);

        const result: ChunkComponent[] = [];
        for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
            for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
                if (chunkY < 0 || chunkY >= this.worldHeightChunks) {
                    continue;
                }
                for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ++) {
                    const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkY, chunkZ));
                    if (chunk) {
                        result.push(chunk);
                    }
                }
            }
        }
        return result;
    }

    setBlockAtWorld(worldX: number, worldY: number, worldZ: number, blockType: BlockType, meta = 0): boolean {
        const resolved = this.resolveWorldBlock(worldX, worldY, worldZ);
        if (!resolved) {
            return false;
        }
        resolved.chunk.setBlock(resolved.localX, resolved.localY, resolved.localZ, blockType);
        resolved.chunk.setBlockMeta(resolved.localX, resolved.localY, resolved.localZ, meta);
        this.relightAround(resolved.chunk);
        return true;
    }

    // Called immediately after a block at (worldX, worldY, worldZ) has been set to Air.
    // Walks the 5 possible torch-attachment directions: if a torch sits at the mirror position
    // and its stored meta index points back to the destroyed block, that torch is detached and
    // removed. Returns the chunk + local coords of every destroyed torch so the caller can emit
    // blockBroken events and trigger item drops.
    //
    // Caller is responsible for calling relightAround after this returns — this method only
    // updates block data; the relight/rebuild is left to the caller so it can be batched with
    // any other state changes for the same frame. relightAround(target.chunk) covers the torch
    // chunks implicitly because torches are always exactly one block from their support, so the
    // torch chunk is either the same chunk or a face-adjacent neighbour (both covered by
    // relightLoadedNeighbors).
    removeDependentTorches(
        worldX: number,
        worldY: number,
        worldZ: number,
    ): Array<{ chunk: ChunkComponent; localX: number; localY: number; localZ: number }> {
        const destroyed: Array<{ chunk: ChunkComponent; localX: number; localY: number; localZ: number }> = [];

        for (let index = 0; index < TORCH_ATTACHMENT_OFFSETS.length; index++) {
            const [deltaX, deltaY, deltaZ] = TORCH_ATTACHMENT_OFFSETS[index];

            // A torch whose attachment offset is [deltaX,deltaY,deltaZ] sits one step in the
            // opposite direction from its support — so if the support is at (worldX,Y,Z), the torch is at:
            const torchWorldX = worldX - deltaX;
            const torchWorldY = worldY - deltaY;
            const torchWorldZ = worldZ - deltaZ;

            if (this.getBlockAtWorld(torchWorldX, torchWorldY, torchWorldZ) !== BlockType.Torch) {
                continue;
            }

            const resolved = this.resolveWorldBlock(torchWorldX, torchWorldY, torchWorldZ);
            if (!resolved) {
                continue;
            }

            // Only remove the torch if its stored attachment direction matches this offset —
            // a torch placed on a different face of the same block slot shouldn't be affected.
            if (resolved.chunk.getBlockMeta(resolved.localX, resolved.localY, resolved.localZ) !== index) {
                continue;
            }

            resolved.chunk.setBlock(resolved.localX, resolved.localY, resolved.localZ, BlockType.Air);
            resolved.chunk.setBlockMeta(resolved.localX, resolved.localY, resolved.localZ, 0);
            destroyed.push({
                chunk: resolved.chunk,
                localX: resolved.localX,
                localY: resolved.localY,
                localZ: resolved.localZ,
            });
        }

        return destroyed;
    }

    getBlockAtWorld(worldX: number, worldY: number, worldZ: number): BlockType {
        const resolved = this.resolveWorldBlock(worldX, worldY, worldZ);
        if (!resolved) {
            return BlockType.Air;
        }
        return resolved.chunk.getBlock(resolved.localX, resolved.localY, resolved.localZ);
    }

    getBlockMetaAtWorld(worldX: number, worldY: number, worldZ: number): number {
        const resolved = this.resolveWorldBlock(worldX, worldY, worldZ);
        if (!resolved) {
            return 0;
        }
        return resolved.chunk.getBlockMeta(resolved.localX, resolved.localY, resolved.localZ);
    }

    private scheduleWaterUpdate(resolved: {
        chunk: ChunkComponent;
        localX: number;
        localY: number;
        localZ: number;
    }): void {
        const chunkX = Math.floor(resolved.chunk.worldOriginX / this.chunkWidth);
        const chunkY = Math.floor(resolved.chunk.worldOriginY / this.chunkHeight);
        const chunkZ = Math.floor(resolved.chunk.worldOriginZ / this.chunkDepth);
        const localIndex =
            resolved.localX * this.chunkHeight * this.chunkDepth + resolved.localY * this.chunkDepth + resolved.localZ;
        const blockKey =
            this.getChunkKey(chunkX, chunkY, chunkZ) * (this.chunkWidth * this.chunkHeight * this.chunkDepth) +
            localIndex;
        const worldX = resolved.chunk.worldOriginX + resolved.localX;
        const worldY = resolved.chunk.worldOriginY + resolved.localY;
        const worldZ = resolved.chunk.worldOriginZ + resolved.localZ;
        this.pendingWaterUpdates.set(blockKey, { worldX, worldY, worldZ });
    }

    scheduleNeighborWaterUpdates(worldX: number, worldY: number, worldZ: number): void {
        for (const [offsetX, offsetY, offsetZ] of NEIGHBOR_OFFSETS) {
            const resolved = this.resolveWorldBlock(worldX + offsetX, worldY + offsetY, worldZ + offsetZ);
            if (resolved?.chunk.getBlock(resolved.localX, resolved.localY, resolved.localZ) === BlockType.Water) {
                this.scheduleWaterUpdate(resolved);
            }
        }
    }

    private tickWater(): void {
        const snapshot = new Map(this.pendingWaterUpdates);
        this.pendingWaterUpdates.clear();

        const affectedChunks = new Set<ChunkComponent>();
        for (const { worldX, worldY, worldZ } of snapshot.values()) {
            this.spreadWaterFrom(worldX, worldY, worldZ, affectedChunks);
        }

        const chunksToRebuild = new Set<ChunkComponent>();
        for (const chunk of affectedChunks) {
            chunksToRebuild.add(chunk);
            const chunkX = Math.floor(chunk.worldOriginX / this.chunkWidth);
            const chunkY = Math.floor(chunk.worldOriginY / this.chunkHeight);
            const chunkZ = Math.floor(chunk.worldOriginZ / this.chunkDepth);
            for (const [offsetX, offsetY, offsetZ] of NEIGHBOR_OFFSETS) {
                const neighborChunkY = chunkY + offsetY;
                if (neighborChunkY < 0 || neighborChunkY >= this.worldHeightChunks) {
                    continue;
                }
                const neighbor = this.chunks.get(this.getChunkKey(chunkX + offsetX, neighborChunkY, chunkZ + offsetZ));
                if (neighbor) {
                    chunksToRebuild.add(neighbor);
                }
            }
        }
        for (const chunk of chunksToRebuild) {
            this.relightAndRebuild(chunk);
        }
    }

    private spreadWaterFrom(worldX: number, worldY: number, worldZ: number, affectedChunks: Set<ChunkComponent>): void {
        const self = this.resolveWorldBlock(worldX, worldY, worldZ);
        if (self?.chunk.getBlock(self.localX, self.localY, self.localZ) !== BlockType.Water) {
            return;
        }

        const currentMeta = self.chunk.getBlockMeta(self.localX, self.localY, self.localZ);
        let didSpread = false;

        // Gravity: try to spread down first. Fallen water resets to meta=0 (new source).
        const below = this.resolveWorldBlock(worldX, worldY - 1, worldZ);
        if (below?.chunk.getBlock(below.localX, below.localY, below.localZ) === BlockType.Air) {
            below.chunk.setBlock(below.localX, below.localY, below.localZ, BlockType.Water);
            below.chunk.setBlockMeta(below.localX, below.localY, below.localZ, 0);
            affectedChunks.add(below.chunk);
            this.scheduleWaterUpdate(below);
            didSpread = true;
        }

        // Horizontal spread only if within flow distance limit.
        if (currentMeta < MAX_WATER_FLOW_DISTANCE) {
            const newMeta = currentMeta + 1;

            for (const [offsetX, , offsetZ] of WATER_HORIZONTAL_OFFSETS) {
                const neighbor = this.resolveWorldBlock(worldX + offsetX, worldY, worldZ + offsetZ);
                if (!neighbor) {
                    continue;
                }

                const neighborBlock = neighbor.chunk.getBlock(neighbor.localX, neighbor.localY, neighbor.localZ);
                const canFlowInto =
                    neighborBlock === BlockType.Air ||
                    (neighborBlock === BlockType.Water &&
                        neighbor.chunk.getBlockMeta(neighbor.localX, neighbor.localY, neighbor.localZ) > newMeta);

                if (!canFlowInto) {
                    continue;
                }

                neighbor.chunk.setBlock(neighbor.localX, neighbor.localY, neighbor.localZ, BlockType.Water);
                neighbor.chunk.setBlockMeta(neighbor.localX, neighbor.localY, neighbor.localZ, newMeta);

                affectedChunks.add(neighbor.chunk);
                this.scheduleWaterUpdate(neighbor);
                didSpread = true;
            }
        }

        // Re-schedule only if this block successfully spread somewhere.
        if (didSpread) {
            this.scheduleWaterUpdate(self);
        }
    }
}
