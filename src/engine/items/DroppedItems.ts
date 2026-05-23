import * as THREE from "three";
import game from "engine/Game";
import TextureManager from "engine/TextureManager";
import { BlockType } from "engine/chunk/ChunkComponent";
import ChunkManager from "engine/chunk/ChunkManager";
import { MAX_LIGHT } from "engine/chunk/LightingSystem";
import Transform from "engine/components/Transform";
import Component from "engine/core/Component";
import eventManager from "engine/core/EventManager";
import { type InventoryItemStack } from "engine/items/InventoryItem";
import { ItemType } from "engine/items/ItemType";
import { applyGravity, stepAxisX, stepAxisY, stepAxisZ } from "engine/physics/voxelPhysics";
import Inventory from "engine/player/Inventory";
import { type BlockBreakEvent } from "engine/player/PlayerBlockInteraction";
import GameObjectName from "engine/utils/gameObjectNames";

const BLOCK_DROPS: Partial<Record<BlockType, InventoryItemStack>> = {
    [BlockType.Grass]: { kind: "block", type: BlockType.Dirt },
    [BlockType.Stone]: { kind: "block", type: BlockType.Cobblestone },
    [BlockType.CoalOre]: { kind: "item", type: ItemType.Coal },
    // OakLog omitted — falls through to the default "drop itself" path.
    [BlockType.OakLeaves]: { kind: "item", type: ItemType.Stick },
};

// Drop probability per block type (0–1). Absent means 1.0 — always drops.
const BLOCK_DROP_CHANCES: Partial<Record<BlockType, number>> = {
    [BlockType.OakLeaves]: 0.25,
};

const POOL_SIZE = 64;
const ITEM_SIZE = 0.3;
const GRAVITY = -20;
const TERMINAL_VELOCITY = -25;
const LIFETIME_SECONDS = 30;
const POP_UP_VELOCITY = 4;
const POP_HORIZONTAL = 1.5;
const PICKUP_RADIUS = 1.0;
const MAGNET_RADIUS = 2;
const MAGNET_SPEED = 6;
const SPIN_SPEED = 2;
const COLLISION_HALF = ITEM_SIZE / 2;

interface DroppedItem {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    age: number;
    item: InventoryItemStack;
    index: number;
}

export default class DroppedItems extends Component {
    private readonly items: DroppedItem[] = [];
    private readonly freeIndices: number[] = [];
    private readonly activeIndices = new Set<number>();
    private readonly blockMaterialsByType = new Map<BlockType, THREE.Material[]>();
    private readonly itemMaterialsByType = new Map<ItemType, THREE.Material[]>();
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
        for (const blockType of [
            BlockType.Dirt,
            BlockType.Grass,
            BlockType.Bedrock,
            BlockType.Stone,
            BlockType.Cobblestone,
            BlockType.OakLog,
        ]) {
            const sideMaterial = TextureManager.getMaterial(blockType, 0);
            const topMaterial = TextureManager.getMaterial(blockType, 1);
            this.blockMaterialsByType.set(blockType, [
                sideMaterial,
                sideMaterial,
                topMaterial,
                sideMaterial,
                sideMaterial,
                sideMaterial,
            ]);
        }

        for (const itemType of [ItemType.Coal, ItemType.Stick]) {
            const sideMaterial = TextureManager.getItemMaterial(itemType, 0);
            const topMaterial = TextureManager.getItemMaterial(itemType, 1);
            this.itemMaterialsByType.set(itemType, [
                sideMaterial,
                sideMaterial,
                topMaterial,
                sideMaterial,
                sideMaterial,
                sideMaterial,
            ]);
        }

        for (let i = 0; i < POOL_SIZE; i++) {
            // Each item needs its own geometry because the chunk shader reads a per-vertex `aLight`
            // attribute and we sample that per-item from the item's world position each frame.
            // A shared geometry would force every item to the same light value.
            const mesh = new THREE.Mesh(this.createItemGeometry(), this.blockMaterialsByType.get(BlockType.Dirt)!);
            mesh.visible = false;
            game.threeScene.add(mesh);
            this.items.push({
                mesh,
                velocity: new THREE.Vector3(),
                age: 0,
                item: { kind: "block", type: BlockType.Dirt }, // placeholder; overwritten in handleBlockBroken before visible
                index: i,
            });
            this.freeIndices.push(i);
        }

        eventManager.subscribe("blockBroken", this.blockBrokenListener);
    }

    update(deltaTime: number) {
        this.expired.length = 0;
        for (const index of this.activeIndices) {
            const droppedItem = this.items[index];
            droppedItem.age += deltaTime;
            if (droppedItem.age >= LIFETIME_SECONDS) {
                this.expired.push(index);
                continue;
            }

            const deltaX = this.playerTransform.x - droppedItem.mesh.position.x;
            const deltaY = this.playerTransform.y - droppedItem.mesh.position.y;
            const deltaZ = this.playerTransform.z - droppedItem.mesh.position.z;
            const distanceSquared = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;

            if (distanceSquared <= PICKUP_RADIUS * PICKUP_RADIUS) {
                if (this.inventory.add(droppedItem.item)) {
                    this.expired.push(index);
                    continue;
                }
            }

            const body = {
                position: droppedItem.mesh.position,
                velocity: droppedItem.velocity,
                halfWidth: COLLISION_HALF,
                halfHeight: COLLISION_HALF,
            };

            if (distanceSquared <= MAGNET_RADIUS * MAGNET_RADIUS) {
                this.scratchToPlayer.set(deltaX, deltaY, deltaZ).normalize().multiplyScalar(MAGNET_SPEED);
                droppedItem.velocity.copy(this.scratchToPlayer);
            } else {
                applyGravity(body, deltaTime, GRAVITY, TERMINAL_VELOCITY);
            }

            const yHit = stepAxisY(body, this.chunkManager, deltaTime);
            if (yHit === "foot") {
                // Zero horizontal velocity too so items settle quickly on landing
                // instead of sliding across uneven terrain.
                droppedItem.velocity.set(0, 0, 0);
            } else if (yHit === "head") {
                droppedItem.velocity.y = 0;
            }
            if (stepAxisX(body, this.chunkManager, deltaTime)) {
                droppedItem.velocity.x = 0;
            }
            if (stepAxisZ(body, this.chunkManager, deltaTime)) {
                droppedItem.velocity.z = 0;
            }

            droppedItem.mesh.rotation.y += SPIN_SPEED * deltaTime;

            this.updateItemLight(droppedItem);
        }

        for (const index of this.expired) {
            this.recycle(index);
        }
    }

    private createItemGeometry(): THREE.BoxGeometry {
        const geometry = new THREE.BoxGeometry(ITEM_SIZE, ITEM_SIZE, ITEM_SIZE);
        const vertexCount = geometry.attributes.position.count;
        const lightArray = new Float32Array(vertexCount);
        lightArray.fill(MAX_LIGHT);
        geometry.setAttribute("aLight", new THREE.BufferAttribute(lightArray, 1));
        return geometry;
    }

    private updateItemLight(droppedItem: DroppedItem): void {
        const sampled = this.chunkManager.getLightAtWorld(
            droppedItem.mesh.position.x,
            droppedItem.mesh.position.y,
            droppedItem.mesh.position.z,
        );
        const attribute = droppedItem.mesh.geometry.attributes.aLight as THREE.BufferAttribute;
        const array = attribute.array as Float32Array;
        if (array[0] === sampled) {
            return;
        }
        array.fill(sampled);
        attribute.needsUpdate = true;
    }

    dispose() {
        eventManager.unsubscribe("blockBroken", this.blockBrokenListener);
        for (const droppedItem of this.items) {
            game.threeScene.remove(droppedItem.mesh);
            droppedItem.mesh.geometry.dispose();
        }
        this.items.length = 0;
        this.freeIndices.length = 0;
        this.activeIndices.clear();
        this.blockMaterialsByType.clear();
        this.itemMaterialsByType.clear();
    }

    private getMaterialsForItem(inventoryItem: InventoryItemStack): THREE.Material[] {
        if (inventoryItem.kind === "block") {
            const materials = this.blockMaterialsByType.get(inventoryItem.type);
            if (!materials) {
                throw new Error(`DroppedItems has no material mapping for BlockType ${inventoryItem.type}`);
            }
            return materials;
        } else {
            const materials = this.itemMaterialsByType.get(inventoryItem.type);
            if (!materials) {
                throw new Error(`DroppedItems has no material mapping for ItemType ${inventoryItem.type}`);
            }
            return materials;
        }
    }

    private handleBlockBroken(event: BlockBreakEvent): void {
        const dropChance = BLOCK_DROP_CHANCES[event.blockType];
        if (dropChance !== undefined && Math.random() >= dropChance) {
            return;
        }

        const dropItem: InventoryItemStack = BLOCK_DROPS[event.blockType] ?? {
            kind: "block",
            type: event.blockType,
        };
        const materials = this.getMaterialsForItem(dropItem);

        const index = this.freeIndices.pop();
        if (index === undefined) {
            console.warn(
                `DroppedItems pool exhausted (size ${POOL_SIZE}); dropping spawn for ${dropItem.kind} ${dropItem.type}`,
            );
            return;
        }

        const droppedItem = this.items[index];
        this.activeIndices.add(index);

        droppedItem.mesh.material = materials;
        droppedItem.item = dropItem;
        droppedItem.mesh.position.set(
            event.chunk.mesh.position.x + event.blockX,
            event.chunk.mesh.position.y + event.blockY,
            event.chunk.mesh.position.z + event.blockZ,
        );
        droppedItem.mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
        droppedItem.velocity.set(
            (Math.random() - 0.5) * POP_HORIZONTAL * 2,
            POP_UP_VELOCITY,
            (Math.random() - 0.5) * POP_HORIZONTAL * 2,
        );
        droppedItem.age = 0;
        droppedItem.mesh.visible = true;
    }

    private recycle(index: number): void {
        const droppedItem = this.items[index];
        droppedItem.mesh.visible = false;
        droppedItem.age = 0;
        this.activeIndices.delete(index);
        this.freeIndices.push(index);
    }
}
