import * as THREE from "three";
import game from "engine/Game";
import { BLOCK_BREAK_STAGE_COUNT } from "engine/TextureManager";
import ChunkComponent, { BlockType, isSolidBlock, torchQuadIndexFromHitNormal } from "engine/chunk/ChunkComponent";
import ChunkManager from "engine/chunk/ChunkManager";
import Transform from "engine/components/Transform";
import Component from "engine/core/Component";
import eventManager from "engine/core/EventManager";
import input from "engine/input/Input";
import { ItemType } from "engine/items/ItemType";
import Inventory from "engine/player/Inventory";
import { playerOverlapsBlock } from "engine/player/PlayerPhysics";
import GameObjectName from "engine/utils/gameObjectNames";

// Maps placeable item types to the block they place in the world.
const ITEM_TO_BLOCK: Partial<Record<ItemType, BlockType>> = {
    [ItemType.Torch]: BlockType.Torch,
};

const RAY_DISTANCE = 3;
export const BREAK_TIME_SECONDS = 1.2;

export interface TargetedBlock {
    chunk: ChunkComponent;
    blockX: number;
    blockY: number;
    blockZ: number;
    blockType: BlockType;
}

export interface BlockBreakEvent {
    chunk: ChunkComponent;
    blockX: number;
    blockY: number;
    blockZ: number;
    blockType: BlockType;
}

export interface StageAdvancedEvent {
    stage: number;
    blockType: BlockType;
    hitPoint: THREE.Vector3;
    hitNormal: THREE.Vector3;
}

export default class PlayerBlockInteraction extends Component {
    private chunkManager!: ChunkManager;
    private inventory!: Inventory;
    private playerTransform!: Transform;
    private readonly raycaster = new THREE.Raycaster();
    private readonly pointer = new THREE.Vector2(0, 0);
    private camera!: THREE.Camera;

    targetedBlock: TargetedBlock | null = null;
    damageProgress = 0;
    breakTimeSeconds = BREAK_TIME_SECONDS;

    private readonly hitPoint = new THREE.Vector3();
    // Exposed for sibling effects (e.g. BlockPlacementPreview). Only valid when targetedBlock is non-null.
    readonly hitNormal = new THREE.Vector3();
    private readonly scratchLocal = new THREE.Vector3();
    private lastEmittedStage = -1;

    constructor() {
        super();
        this.raycaster.far = RAY_DISTANCE;
    }

    start() {
        this.camera = game.camera.threeCamera;
        this.chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);
        this.inventory = this.gameObject.getComponent(Inventory);
        this.playerTransform = this.gameObject.getComponent(Transform);
    }

    get damageStage(): number {
        if (this.damageProgress <= 0) {
            return -1;
        }
        return Math.min(BLOCK_BREAK_STAGE_COUNT - 1, Math.floor(this.damageProgress * BLOCK_BREAK_STAGE_COUNT));
    }

    update(deltaTime: number) {
        const target = this.raycastTarget();

        if (!this.sameTarget(target, this.targetedBlock)) {
            this.resetProgress();
            eventManager.emit("targetedBlockChanged", target);
        }
        this.targetedBlock = target;

        // Right-click placement — checked before the mining guard so it works regardless of hand state.
        if (target && input.wasMousePressed(2)) {
            this.tryPlaceBlock(target);
            return;
        }

        if (!target || !input.isMouseHeld(0)) {
            this.resetProgress();
            return;
        }

        this.damageProgress += deltaTime / this.breakTimeSeconds;

        if (this.damageProgress >= 1) {
            const broken: BlockBreakEvent = {
                chunk: target.chunk,
                blockX: target.blockX,
                blockY: target.blockY,
                blockZ: target.blockZ,
                blockType: target.blockType,
            };
            const broke = target.chunk.hitBlock(target.blockX, target.blockY, target.blockZ, 255);
            if (broke) {
                // If there are any attached torches - break those also
                const worldX = target.chunk.worldOriginX + target.blockX;
                const worldY = target.chunk.worldOriginY + target.blockY;
                const worldZ = target.chunk.worldOriginZ + target.blockZ;
                const cascadedTorches = this.chunkManager.removeDependentTorches(worldX, worldY, worldZ);
                for (const { chunk, localX, localY, localZ } of cascadedTorches) {
                    eventManager.emit("blockBroken", {
                        chunk,
                        blockX: localX,
                        blockY: localY,
                        blockZ: localZ,
                        blockType: BlockType.Torch,
                    });
                }
                this.chunkManager.relightAround(target.chunk);
                this.chunkManager.scheduleNeighborWaterUpdates(worldX, worldY, worldZ);
            }
            eventManager.emit("blockBroken", broken);
            this.resetProgress();
            this.targetedBlock = null;
            eventManager.emit("targetedBlockChanged", null);
            return;
        }

        const currentStage = this.damageStage;
        if (currentStage !== this.lastEmittedStage) {
            this.lastEmittedStage = currentStage;
            const event: StageAdvancedEvent = {
                stage: currentStage,
                blockType: target.blockType,
                hitPoint: this.hitPoint.clone(),
                hitNormal: this.hitNormal.clone(),
            };
            eventManager.emit("blockDamageStageAdvanced", event);
        }
    }

    private tryPlaceBlock(target: TargetedBlock): void {
        const slot = this.inventory.getSlot(this.inventory.selectedHotbarSlot);
        if (!slot) {
            return;
        }

        let blockTypeToPlace: BlockType;
        let placementMeta = 0;
        if (slot.item.kind === "block") {
            blockTypeToPlace = slot.item.type;
        } else if (slot.item.kind === "item") {
            const mapped = ITEM_TO_BLOCK[slot.item.type];
            if (mapped === undefined) {
                return;
            }
            // Items that place as world objects require a solid block face to attach to —
            // prevent placing on another torch, leaves, or any passable block.
            if (!isSolidBlock(target.blockType)) {
                return;
            }
            blockTypeToPlace = mapped;
            if (blockTypeToPlace === BlockType.Torch) {
                const quadIndex = torchQuadIndexFromHitNormal(this.hitNormal.x, this.hitNormal.y, this.hitNormal.z);
                if (quadIndex === -1) {
                    return; // ceiling placement has no geometry — silently disallow
                }
                placementMeta = quadIndex;
            }
        } else {
            return;
        }

        // Step one block outward along the face normal to find the adjacent (placement) cell.
        const worldPlaceX = target.chunk.worldOriginX + target.blockX + this.hitNormal.x;
        const worldPlaceY = target.chunk.worldOriginY + target.blockY + this.hitNormal.y;
        const worldPlaceZ = target.chunk.worldOriginZ + target.blockZ + this.hitNormal.z;

        if (this.chunkManager.getBlockAtWorld(worldPlaceX, worldPlaceY, worldPlaceZ) !== BlockType.Air) {
            return;
        }

        if (playerOverlapsBlock(this.playerTransform, worldPlaceX, worldPlaceY, worldPlaceZ)) {
            return;
        }

        const placed = this.chunkManager.setBlockAtWorld(
            worldPlaceX,
            worldPlaceY,
            worldPlaceZ,
            blockTypeToPlace,
            placementMeta,
        );
        if (placed) {
            this.inventory.consumeSelectedSlot();
        }
    }

    private resetProgress(): void {
        this.damageProgress = 0;
        this.lastEmittedStage = -1;
    }

    private sameTarget(a: TargetedBlock | null, b: TargetedBlock | null): boolean {
        if (a === null && b === null) {
            return true;
        }
        if (a === null || b === null) {
            return false;
        }
        return a.chunk === b.chunk && a.blockX === b.blockX && a.blockY === b.blockY && a.blockZ === b.blockZ;
    }

    private raycastTarget(): TargetedBlock | null {
        this.raycaster.setFromCamera(this.pointer, this.camera);

        const chunks = this.chunkManager.getChunksAlongRay(
            this.raycaster.ray.origin,
            this.raycaster.ray.direction,
            RAY_DISTANCE,
        );
        const meshes = chunks.map(chunk => chunk.mesh);
        const hits = this.raycaster.intersectObjects(meshes, true);
        if (!hits.length) {
            return null;
        }

        const hit = hits[0];
        const chunkGroup = hit.object.parent;
        const chunk = chunkGroup?.userData.chunk as ChunkComponent | undefined;
        if (!chunk || !chunkGroup || !hit.face) {
            return null;
        }

        // step 0.5 inside the face so Math.round lands on the block's integer-coordinate center
        this.scratchLocal.copy(hit.point).addScaledVector(hit.face.normal, -0.5).sub(chunkGroup.position);
        const blockX = Math.round(this.scratchLocal.x);
        const blockY = Math.round(this.scratchLocal.y);
        const blockZ = Math.round(this.scratchLocal.z);

        const blockType = chunk.getBlock(blockX, blockY, blockZ);
        if (blockType === BlockType.Air || blockType === BlockType.Water) {
            return null;
        }

        this.hitPoint.copy(hit.point);
        this.hitNormal.copy(hit.face.normal);

        return {
            chunk,
            blockX,
            blockY,
            blockZ,
            blockType,
        };
    }
}
