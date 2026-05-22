import * as THREE from "three";
import game from "engine/Game";
import { BLOCK_BREAK_STAGE_COUNT } from "engine/TextureManager";
import ChunkComponent, { BlockType } from "engine/chunk/ChunkComponent";
import ChunkManager from "engine/chunk/ChunkManager";
import Transform from "engine/components/Transform";
import Component from "engine/core/Component";
import eventManager from "engine/core/EventManager";
import input from "engine/input/Input";
import Inventory from "engine/player/Inventory";
import { playerOverlapsBlock } from "engine/player/PlayerPhysics";
import GameObjectName from "engine/utils/gameObjectNames";

const RAY_DISTANCE = 4;
const BREAK_TIME_SECONDS = 1.2;

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

        this.damageProgress += deltaTime / BREAK_TIME_SECONDS;

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
                this.chunkManager.relightAround(target.chunk);
            }
            eventManager.emit("blockBroken", broken);
            this.resetProgress();
            this.targetedBlock = null;
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

        const placed = this.chunkManager.setBlockAtWorld(worldPlaceX, worldPlaceY, worldPlaceZ, slot.blockType);
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

        this.hitPoint.copy(hit.point);
        this.hitNormal.copy(hit.face.normal);

        return {
            chunk,
            blockX,
            blockY,
            blockZ,
            blockType: chunk.getBlock(blockX, blockY, blockZ),
        };
    }
}
