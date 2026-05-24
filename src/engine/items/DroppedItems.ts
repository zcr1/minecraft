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
import Inventory, { type InventorySlot } from "engine/player/Inventory";
import { type BlockBreakEvent } from "engine/player/PlayerBlockInteraction";
import GameObjectName from "engine/utils/gameObjectNames";

// Defines drops that are not identical to themselves
const BLOCK_DROPS: Partial<Record<BlockType, InventoryItemStack>> = {
    [BlockType.Grass]: { kind: "block", type: BlockType.Dirt },
    [BlockType.Stone]: { kind: "block", type: BlockType.Cobblestone },
    [BlockType.CoalOre]: { kind: "item", type: ItemType.Coal },
    // OakLog omitted — falls through to the default "drop itself" path.
    [BlockType.OakLeaves]: { kind: "item", type: ItemType.Stick },
    // Torch is stored as BlockType in the world but the player holds/places ItemType.Torch.
    [BlockType.Torch]: { kind: "item", type: ItemType.Torch },
};

// Drop probability per block type (0–1). Absent means 1.0 — always drops.
const BLOCK_DROP_CHANCES: Partial<Record<BlockType, number>> = {
    [BlockType.OakLeaves]: 0.25,
};

const POOL_SIZE = 64;
const ITEM_SIZE = 0.3;
const FLAT_ITEM_SIZE = 0.4;
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
// Time in seconds before a player-dropped item can be picked up again.
const DROP_PICKUP_COOLDOWN = 2.0;

interface DroppedItem {
    age: number;
    boxGeometry: THREE.BufferGeometry;
    count: number;
    flatGeometry: THREE.BufferGeometry;
    index: number;
    item: InventoryItemStack;
    mesh: THREE.Mesh;
    pickupCooldown: number;
    velocity: THREE.Vector3;
}

export default class DroppedItems extends Component {
    private readonly items: DroppedItem[] = [];
    private readonly freeIndices: number[] = [];
    private readonly activeIndices = new Set<number>();
    private readonly blockMaterialsByType = new Map<BlockType, THREE.Material[]>();
    private readonly scratchToPlayer = new THREE.Vector3();
    private readonly expired: number[] = [];
    private chunkManager!: ChunkManager;
    private playerTransform!: Transform;
    private inventory!: Inventory;
    private readonly blockBrokenListener = (event: BlockBreakEvent) => this.handleBlockBroken(event);
    private readonly itemDroppedListener = (slot: InventorySlot) => this.handleItemDropped(slot);

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
            BlockType.OakPlanks,
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

        for (let i = 0; i < POOL_SIZE; i++) {
            // Each item needs its own geometry because the chunk shader reads a per-vertex `aLight`
            // attribute and we sample that per-item from the item's world position each frame.
            // A shared geometry would force every item to the same light value.
            const boxGeometry = this.createBoxGeometry();
            const flatGeometry = this.createFlatGeometry();
            const mesh = new THREE.Mesh(boxGeometry, this.blockMaterialsByType.get(BlockType.Dirt)!);
            mesh.visible = false;
            game.threeScene.add(mesh);
            this.items.push({
                mesh,
                boxGeometry,
                flatGeometry,
                velocity: new THREE.Vector3(),
                age: 0,
                count: 1,
                pickupCooldown: 0,
                item: { kind: "block", type: BlockType.Dirt }, // placeholder; overwritten before visible
                index: i,
            });
            this.freeIndices.push(i);
        }

        eventManager.subscribe("blockBroken", this.blockBrokenListener);
        eventManager.subscribe("itemDropped", this.itemDroppedListener);
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

            if (droppedItem.pickupCooldown > 0) {
                droppedItem.pickupCooldown -= deltaTime;
            } else if (distanceSquared <= PICKUP_RADIUS * PICKUP_RADIUS) {
                if (this.inventory.add(droppedItem.item, droppedItem.count)) {
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

            if (droppedItem.pickupCooldown <= 0 && distanceSquared <= MAGNET_RADIUS * MAGNET_RADIUS) {
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

    private createBoxGeometry(): THREE.BoxGeometry {
        const geometry = new THREE.BoxGeometry(ITEM_SIZE, ITEM_SIZE, ITEM_SIZE);
        const vertexCount = geometry.attributes.position.count;
        const lightArray = new Float32Array(vertexCount);
        lightArray.fill(MAX_LIGHT);
        geometry.setAttribute("aLight", new THREE.BufferAttribute(lightArray, 1));
        return geometry;
    }

    // Flat quad used for pure items (coal, stick, etc.) — rendered as a spinning 2-D sprite.
    // PlaneGeometry sits in the XY plane by default (facing +Z); spinning around Y shows the
    // texture face-on throughout most of the rotation cycle. DoubleSide material handles the
    // back face so it's visible from either direction.
    private createFlatGeometry(): THREE.PlaneGeometry {
        const geometry = new THREE.PlaneGeometry(FLAT_ITEM_SIZE, FLAT_ITEM_SIZE);
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
        eventManager.unsubscribe("itemDropped", this.itemDroppedListener);
        for (const droppedItem of this.items) {
            game.threeScene.remove(droppedItem.mesh);
            droppedItem.boxGeometry.dispose();
            droppedItem.flatGeometry.dispose();
        }
        this.items.length = 0;
        this.freeIndices.length = 0;
        this.activeIndices.clear();
        this.blockMaterialsByType.clear();
    }

    private getBlockMaterials(inventoryItem: InventoryItemStack & { kind: "block" }): THREE.Material[] {
        const materials = this.blockMaterialsByType.get(inventoryItem.type);
        if (!materials) {
            throw new Error(`DroppedItems has no material mapping for BlockType ${inventoryItem.type}`);
        }
        return materials;
    }

    private handleBlockBroken(event: BlockBreakEvent): void {
        const dropChance = BLOCK_DROP_CHANCES[event.blockType];
        if (dropChance !== undefined && Math.random() >= dropChance) {
            return;
        }

        const item: InventoryItemStack = BLOCK_DROPS[event.blockType] ?? {
            kind: "block",
            type: event.blockType,
        };

        this.spawnItem(
            item,
            new THREE.Vector3(
                event.chunk.mesh.position.x + event.blockX,
                event.chunk.mesh.position.y + event.blockY,
                event.chunk.mesh.position.z + event.blockZ,
            ),
            new THREE.Vector3(
                (Math.random() - 0.5) * POP_HORIZONTAL * 2,
                POP_UP_VELOCITY,
                (Math.random() - 0.5) * POP_HORIZONTAL * 2,
            ),
        );
    }

    private handleItemDropped(slot: InventorySlot): void {
        const forward = new THREE.Vector3();
        game.camera.threeCamera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() > 0) {
            forward.normalize();
        }

        this.spawnItem(
            slot.item,
            new THREE.Vector3(
                this.playerTransform.x + forward.x,
                this.playerTransform.y,
                this.playerTransform.z + forward.z,
            ),
            new THREE.Vector3(
                (Math.random() - 0.5) * POP_HORIZONTAL * 3,
                POP_UP_VELOCITY * 0.5,
                (Math.random() - 0.5) * POP_HORIZONTAL * 3,
            ),
            DROP_PICKUP_COOLDOWN,
            slot.count,
        );
    }

    // Activates a pooled item mesh at the given position with the given velocity.
    // pickupCooldown delays magnet attraction and auto-collection (seconds).
    private spawnItem(
        item: InventoryItemStack,
        position: THREE.Vector3,
        velocity: THREE.Vector3,
        pickupCooldown = 0,
        count = 1,
    ): void {
        const index = this.freeIndices.pop();
        if (index === undefined) {
            console.warn(
                `DroppedItems pool exhausted (size ${POOL_SIZE}); dropping spawn for ${item.kind} ${item.type}`,
            );
            return;
        }

        const droppedItem = this.items[index];
        this.activeIndices.add(index);

        if (item.kind === "item") {
            // Pure items (coal, stick, etc.) render as a spinning flat sprite.
            droppedItem.mesh.geometry = droppedItem.flatGeometry;
            droppedItem.mesh.material = TextureManager.getFlatItemMaterial(item.type);
        } else {
            droppedItem.mesh.geometry = droppedItem.boxGeometry;
            droppedItem.mesh.material = this.getBlockMaterials(item);
        }

        droppedItem.item = item;
        droppedItem.count = count;
        droppedItem.mesh.position.copy(position);
        // Flat sprites get a slight forward tilt so they read well at low viewing angles
        // instead of appearing as a perfectly vertical card.
        const tiltX = item.kind === "item" ? Math.PI / 12 : 0;
        droppedItem.mesh.rotation.set(tiltX, Math.random() * Math.PI * 2, 0);
        droppedItem.velocity.copy(velocity);
        droppedItem.age = 0;
        droppedItem.pickupCooldown = pickupCooldown;
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
