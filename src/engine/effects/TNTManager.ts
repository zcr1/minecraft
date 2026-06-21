import game from "engine/Game";
import { BlockType } from "engine/block/BlockType";
import ChunkManager from "engine/chunk/ChunkManager";
import Component from "engine/core/Component";
import eventManager, { type BlockPlacedEvent } from "engine/core/EventManager";
import GameObjectName from "engine/utils/gameObjectNames";

const FUSE_SECONDS = 4;
const BLAST_RADIUS = 4;
const BLAST_RADIUS_SQ = BLAST_RADIUS * BLAST_RADIUS;

interface PendingExplosion {
    worldX: number;
    worldY: number;
    worldZ: number;
    fuseRemaining: number;
}

export default class TNTManager extends Component {
    private chunkManager!: ChunkManager;
    private pendingExplosions: PendingExplosion[] = [];

    start(): void {
        this.chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);
        eventManager.subscribe("blockPlaced", this.handleBlockPlaced);
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
        this.pendingExplosions.push({ worldX, worldY, worldZ, fuseRemaining: FUSE_SECONDS });
    };

    private explode(worldX: number, worldY: number, worldZ: number): void {
        const positions: Array<{ worldX: number; worldY: number; worldZ: number }> = [];
        for (let deltaX = -BLAST_RADIUS; deltaX <= BLAST_RADIUS; deltaX++) {
            for (let deltaY = -BLAST_RADIUS; deltaY <= BLAST_RADIUS; deltaY++) {
                for (let deltaZ = -BLAST_RADIUS; deltaZ <= BLAST_RADIUS; deltaZ++) {
                    if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ <= BLAST_RADIUS_SQ) {
                        positions.push({
                            worldX: worldX + deltaX,
                            worldY: worldY + deltaY,
                            worldZ: worldZ + deltaZ,
                        });
                    }
                }
            }
        }

        this.chunkManager.setBlocksBatch(positions, BlockType.Air);
    }

    dispose(): void {
        eventManager.unsubscribe("blockPlaced", this.handleBlockPlaced);
        this.pendingExplosions = [];
    }
}
