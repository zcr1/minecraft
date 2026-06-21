import game from "engine/Game";
import { BlockType, INDESTRUCTIBLE_BLOCKS } from "engine/block/BlockType";
import ChunkManager from "engine/chunk/ChunkManager";
import Component from "engine/core/Component";
import eventManager, { type BlockPlacedEvent } from "engine/core/EventManager";
import type { BlockBreakEvent } from "engine/player/PlayerBlockInteraction";
import GameObjectName from "engine/utils/gameObjectNames";

const FUSE_SECONDS = 4;
// Short fuse for TNT primed by another blast, so chains cascade visibly instead of all at once.
const CHAIN_FUSE_SECONDS = 0.3;
const BLAST_RADIUS = 4;
const BLAST_RADIUS_SQ = BLAST_RADIUS * BLAST_RADIUS;

export interface PendingExplosion {
    worldX: number;
    worldY: number;
    worldZ: number;
    fuseRemaining: number;
    totalFuse: number;
}

export default class TNTManager extends Component {
    private chunkManager!: ChunkManager;
    private pendingExplosions: PendingExplosion[] = [];

    get activeFuses(): readonly PendingExplosion[] {
        return this.pendingExplosions;
    }

    start(): void {
        this.chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);
        eventManager.subscribe("blockPlaced", this.handleBlockPlaced);
        eventManager.subscribe("blockBroken", this.handleBlockBroken);
    }

    update(deltaTime: number): void {
        for (const pending of this.pendingExplosions) {
            pending.fuseRemaining -= deltaTime;
        }

        const toExplode = this.pendingExplosions.filter(pending => pending.fuseRemaining <= 0);
        this.pendingExplosions = this.pendingExplosions.filter(pending => pending.fuseRemaining > 0);

        for (const pending of toExplode) {
            this.explode(pending.worldX, pending.worldY, pending.worldZ);
        }
    }

    private readonly handleBlockPlaced = (event: BlockPlacedEvent): void => {
        if (event.blockType !== BlockType.TNT) {
            return;
        }

        const { worldX, worldY, worldZ } = event;
        this.pendingExplosions.push({ worldX, worldY, worldZ, fuseRemaining: FUSE_SECONDS, totalFuse: FUSE_SECONDS });
    };

    // Cancel a primed TNT's fuse when its block is removed (mined, or otherwise broken) so it no
    // longer detonates. A no-op for the non-TNT blocks the explosion itself breaks, since those never
    // have a pending entry — keeps the listener safe against explode()'s synchronous blockBroken emits.
    private readonly handleBlockBroken = (event: BlockBreakEvent): void => {
        const worldX = event.chunk.worldOriginX + event.blockX;
        const worldY = event.chunk.worldOriginY + event.blockY;
        const worldZ = event.chunk.worldOriginZ + event.blockZ;
        this.cancelPendingAt(worldX, worldY, worldZ);
    };

    private cancelPendingAt(worldX: number, worldY: number, worldZ: number): void {
        this.pendingExplosions = this.pendingExplosions.filter(
            pending => pending.worldX !== worldX || pending.worldY !== worldY || pending.worldZ !== worldZ,
        );
    }

    private explode(worldX: number, worldY: number, worldZ: number): void {
        // Fire the visual burst at the detonation center before any blocks clear, so ExplosionParticles
        // has a stable origin regardless of what the blast removes this frame.
        eventManager.emit("tntExploded", { worldX, worldY, worldZ });

        const clearPositions: Array<{ worldX: number; worldY: number; worldZ: number }> = [];
        const drops: BlockBreakEvent[] = [];

        for (let deltaX = -BLAST_RADIUS; deltaX <= BLAST_RADIUS; deltaX++) {
            for (let deltaY = -BLAST_RADIUS; deltaY <= BLAST_RADIUS; deltaY++) {
                for (let deltaZ = -BLAST_RADIUS; deltaZ <= BLAST_RADIUS; deltaZ++) {
                    if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ > BLAST_RADIUS_SQ) {
                        continue;
                    }

                    const blockWorldX = worldX + deltaX;
                    const blockWorldY = worldY + deltaY;
                    const blockWorldZ = worldZ + deltaZ;
                    const resolved = this.chunkManager.resolveWorldBlock(blockWorldX, blockWorldY, blockWorldZ);
                    if (!resolved) {
                        continue;
                    }

                    const blockType = resolved.chunk.getBlock(resolved.localX, resolved.localY, resolved.localZ);
                    // Bedrock and water (and air) survive blasts, matching ChunkComponent.destroyBlock.
                    if (INDESTRUCTIBLE_BLOCKS.has(blockType)) {
                        continue;
                    }

                    const isCenter = deltaX === 0 && deltaY === 0 && deltaZ === 0;
                    if (blockType === BlockType.TNT && !isCenter) {
                        // Chain: re-prime with a short fuse and leave the block intact so it stays
                        // visible until its own explosion clears it. Drop any longer existing fuse first.
                        this.cancelPendingAt(blockWorldX, blockWorldY, blockWorldZ);
                        this.pendingExplosions.push({
                            worldX: blockWorldX,
                            worldY: blockWorldY,
                            worldZ: blockWorldZ,
                            fuseRemaining: CHAIN_FUSE_SECONDS,
                            totalFuse: CHAIN_FUSE_SECONDS,
                        });
                        continue;
                    }

                    clearPositions.push({ worldX: blockWorldX, worldY: blockWorldY, worldZ: blockWorldZ });
                    // The detonating TNT itself is consumed — it neither drops nor chains.
                    if (!isCenter) {
                        drops.push({
                            chunk: resolved.chunk,
                            blockX: resolved.localX,
                            blockY: resolved.localY,
                            blockZ: resolved.localZ,
                            blockType,
                        });
                    }
                }
            }
        }

        // setBlocksBatch relights each affected chunk once; emitting blockBroken afterward only drives
        // item/particle spawns (drop logic reads the event coords, not live block state).
        this.chunkManager.setBlocksBatch(clearPositions, BlockType.Air);

        // Wake any water bordering the newly-cleared blocks so it flows into the crater
        for (const position of clearPositions) {
            this.chunkManager.scheduleNeighborWaterUpdates(position.worldX, position.worldY, position.worldZ);
        }

        for (const drop of drops) {
            eventManager.emit("blockBroken", drop);
        }
    }

    dispose(): void {
        eventManager.unsubscribe("blockPlaced", this.handleBlockPlaced);
        eventManager.unsubscribe("blockBroken", this.handleBlockBroken);
        this.pendingExplosions = [];
    }
}
