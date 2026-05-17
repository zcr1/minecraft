import * as THREE from "three";
import game from "engine/Game";
import TextureManager from "engine/TextureManager";
import { BlockType } from "engine/chunk/ChunkComponent";
import ChunkManager from "engine/chunk/ChunkManager";
import Transform from "engine/components/Transform";
import Component from "engine/core/Component";
import eventManager from "engine/core/EventManager";
import { applyGravity, stepAxisX, stepAxisY, stepAxisZ } from "engine/physics/voxelPhysics";
import Inventory from "engine/player/Inventory";
import { type BlockBreakEvent } from "engine/player/PlayerBlockInteraction";
import GameObjectName from "engine/utils/gameObjectNames";

const POOL_SIZE = 64;
const ITEM_SIZE = 0.3;
const GRAVITY = -20;
const TERMINAL_VELOCITY = -25;
const LIFETIME_SECONDS = 30;
const POP_UP_VELOCITY = 4;
const POP_HORIZONTAL = 1.5;
const PICKUP_RADIUS = 1.0;
const MAGNET_RADIUS = 2.5;
const MAGNET_SPEED = 6;
const SPIN_SPEED = 2;
const COLLISION_HALF = ITEM_SIZE / 2;

interface DroppedItem {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    age: number;
    blockType: BlockType;
    index: number;
}

export default class DroppedItems extends Component {
    private readonly geometry = new THREE.BoxGeometry(ITEM_SIZE, ITEM_SIZE, ITEM_SIZE);
    private readonly items: DroppedItem[] = [];
    private readonly freeIndices: number[] = [];
    private readonly activeIndices = new Set<number>();
    private readonly materialsByType = new Map<BlockType, THREE.Material[]>();
    private readonly scratchToPlayer = new THREE.Vector3();
    private readonly expired: number[] = [];
    private chunkManager!: ChunkManager;
    private playerTransform!: Transform;
    private inventory!: Inventory;
    private readonly blockBrokenListener = (event: BlockBreakEvent) => this.handleBlockBroken(event);

    start() {
        const playerObject = game.getGameObject(GameObjectName.Player);
        this.playerTransform = playerObject.getComponent(Transform);
        this.inventory = playerObject.getComponent(Inventory);
        this.chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);

        // BoxGeometry face order is +X, -X, +Y, -Y, +Z, -Z. Only the +Y face uses the "top"
        // material variant; the rest fall through to the side/default texture.
        for (const blockType of [BlockType.Dirt, BlockType.Grass, BlockType.Bedrock]) {
            const sideMaterial = TextureManager.getMaterial(blockType, 0);
            const topMaterial = TextureManager.getMaterial(blockType, 1);
            this.materialsByType.set(blockType, [
                sideMaterial,
                sideMaterial,
                topMaterial,
                sideMaterial,
                sideMaterial,
                sideMaterial,
            ]);
        }

        for (let i = 0; i < POOL_SIZE; i++) {
            const mesh = new THREE.Mesh(this.geometry, this.materialsByType.get(BlockType.Dirt)!);
            mesh.visible = false;
            game.threeScene.add(mesh);
            this.items.push({
                mesh,
                velocity: new THREE.Vector3(),
                age: 0,
                blockType: BlockType.Air,
                index: i,
            });
            this.freeIndices.push(i);
        }

        eventManager.subscribe("blockBroken", this.blockBrokenListener);
    }

    update(deltaTime: number) {
        this.expired.length = 0;
        for (const index of this.activeIndices) {
            const item = this.items[index];
            item.age += deltaTime;
            if (item.age >= LIFETIME_SECONDS) {
                this.expired.push(index);
                continue;
            }

            const deltaX = this.playerTransform.x - item.mesh.position.x;
            const deltaY = this.playerTransform.y - item.mesh.position.y;
            const deltaZ = this.playerTransform.z - item.mesh.position.z;
            const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;

            if (distanceSquared <= PICKUP_RADIUS * PICKUP_RADIUS) {
                this.inventory.add(item.blockType);
                this.expired.push(index);
                continue;
            }

            const body = {
                position: item.mesh.position,
                velocity: item.velocity,
                halfWidth: COLLISION_HALF,
                halfHeight: COLLISION_HALF,
            };

            if (distanceSquared <= MAGNET_RADIUS * MAGNET_RADIUS) {
                this.scratchToPlayer.set(deltaX, deltaY, deltaZ).normalize().multiplyScalar(MAGNET_SPEED);
                item.velocity.copy(this.scratchToPlayer);
            } else {
                applyGravity(body, deltaTime, GRAVITY, TERMINAL_VELOCITY);
            }

            const yHit = stepAxisY(body, this.chunkManager, deltaTime);
            if (yHit === "foot") {
                // Zero horizontal velocity too so items settle quickly on landing
                // instead of sliding across uneven terrain.
                item.velocity.set(0, 0, 0);
            } else if (yHit === "head") {
                item.velocity.y = 0;
            }
            if (stepAxisX(body, this.chunkManager, deltaTime)) {
                item.velocity.x = 0;
            }
            if (stepAxisZ(body, this.chunkManager, deltaTime)) {
                item.velocity.z = 0;
            }

            item.mesh.rotation.y += SPIN_SPEED * deltaTime;
        }

        for (const index of this.expired) {
            this.recycle(index);
        }
    }

    dispose() {
        eventManager.unsubscribe("blockBroken", this.blockBrokenListener);
        for (const item of this.items) {
            game.threeScene.remove(item.mesh);
        }
        this.geometry.dispose();
        this.items.length = 0;
        this.freeIndices.length = 0;
        this.activeIndices.clear();
        this.materialsByType.clear();
    }

    private handleBlockBroken(event: BlockBreakEvent): void {
        const materials = this.materialsByType.get(event.blockType);
        if (!materials) {
            throw new Error(`DroppedItems has no material mapping for BlockType ${event.blockType}`);
        }

        const index = this.freeIndices.pop();
        if (index === undefined) {
            console.warn(
                `DroppedItems pool exhausted (size ${POOL_SIZE}); dropping spawn for BlockType ${event.blockType}`,
            );
            return;
        }

        const item = this.items[index];
        this.activeIndices.add(index);

        item.mesh.material = materials;
        item.blockType = event.blockType;
        item.mesh.position.set(
            event.chunk.mesh.position.x + event.blockX,
            event.chunk.mesh.position.y + event.blockY,
            event.chunk.mesh.position.z + event.blockZ,
        );
        item.mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
        item.velocity.set(
            (Math.random() - 0.5) * POP_HORIZONTAL * 2,
            POP_UP_VELOCITY,
            (Math.random() - 0.5) * POP_HORIZONTAL * 2,
        );
        item.age = 0;
        item.mesh.visible = true;
    }

    private recycle(index: number): void {
        const item = this.items[index];
        item.mesh.visible = false;
        item.age = 0;
        this.activeIndices.delete(index);
        this.freeIndices.push(index);
    }
}
