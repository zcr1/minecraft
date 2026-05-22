import * as THREE from "three";
import game from "../Game";
import Transform from "../components/Transform";
import Component from "../core/Component";
import GameObjectName from "../utils/gameObjectNames";
import ChunkComponent, { BlockType } from "./ChunkComponent";
import lightingSystem, { MAX_LIGHT } from "./LightingSystem";
import TerrainGenerator from "./TerrainGenerator";

const GENERATION_BUDGET_PER_FRAME = 2;

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
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

    // Self first so neighbors' edge-seed pass reads fresh light when they recompute.
    relightAround(chunk: ChunkComponent): void {
        this.relightAndRebuild(chunk);
        const chunkX = Math.floor(chunk.worldOriginX / this.chunkWidth);
        const chunkY = Math.floor(chunk.worldOriginY / this.chunkHeight);
        const chunkZ = Math.floor(chunk.worldOriginZ / this.chunkDepth);
        this.relightLoadedNeighbors(chunkX, chunkY, chunkZ);
    }

    getLightAtWorld(worldX: number, worldY: number, worldZ: number): number {
        const blockX = Math.round(worldX);
        const blockY = Math.round(worldY);
        const blockZ = Math.round(worldZ);

        // Above the world's vertical cap is open sky (full skylight); below the world is treated
        // as opaque underground (0). Unloaded chunks inside the cap fall through to the !chunk
        // branch below and also return 0 - the streaming relight in getOrCreateChunk corrects
        // any seams that creates.
        const chunkY = Math.floor(blockY / this.chunkHeight);
        if (chunkY >= this.worldHeightChunks) {
            return MAX_LIGHT;
        }
        if (chunkY < 0) {
            return 0;
        }

        const chunkX = Math.floor(blockX / this.chunkWidth);
        const chunkZ = Math.floor(blockZ / this.chunkDepth);

        const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkY, chunkZ));
        if (!chunk) {
            return 0;
        }

        const localX = blockX - chunkX * this.chunkWidth;
        const localY = blockY - chunkY * this.chunkHeight;
        const localZ = blockZ - chunkZ * this.chunkDepth;

        return chunk.getSkyLight(localX, localY, localZ);
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

    update() {
        this.updateLoadedChunks();
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

    setBlockAtWorld(worldX: number, worldY: number, worldZ: number, blockType: BlockType): boolean {
        const blockX = Math.round(worldX);
        const blockY = Math.round(worldY);
        const blockZ = Math.round(worldZ);

        const chunkX = Math.floor(blockX / this.chunkWidth);
        const chunkY = Math.floor(blockY / this.chunkHeight);
        const chunkZ = Math.floor(blockZ / this.chunkDepth);

        if (chunkY < 0 || chunkY >= this.worldHeightChunks) {
            return false;
        }

        const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkY, chunkZ));
        if (!chunk) {
            return false;
        }

        const localX = blockX - chunkX * this.chunkWidth;
        const localY = blockY - chunkY * this.chunkHeight;
        const localZ = blockZ - chunkZ * this.chunkDepth;

        chunk.setBlock(localX, localY, localZ, blockType);
        this.relightAround(chunk);
        return true;
    }

    getBlockAtWorld(worldX: number, worldY: number, worldZ: number): BlockType {
        const blockX = Math.round(worldX);
        const blockY = Math.round(worldY);
        const blockZ = Math.round(worldZ);

        const chunkX = Math.floor(blockX / this.chunkWidth);
        const chunkY = Math.floor(blockY / this.chunkHeight);
        const chunkZ = Math.floor(blockZ / this.chunkDepth);

        if (chunkY < 0 || chunkY >= this.worldHeightChunks) {
            return BlockType.Air;
        }

        const chunk = this.chunks.get(this.getChunkKey(chunkX, chunkY, chunkZ));
        if (!chunk) {
            return BlockType.Air;
        }

        const localX = blockX - chunkX * this.chunkWidth;
        const localY = blockY - chunkY * this.chunkHeight;
        const localZ = blockZ - chunkZ * this.chunkDepth;

        return chunk.getBlock(localX, localY, localZ);
    }
}
