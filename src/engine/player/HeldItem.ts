import * as THREE from "three";
import game from "engine/Game";
import TextureManager from "engine/TextureManager";
import { BlockType } from "engine/block/BlockType";
import { MAX_LIGHT } from "engine/chunk/LightingSystem";
import Component from "engine/core/Component";
import eventManager from "engine/core/EventManager";
import { type InventoryItemStack, itemStacksEqual } from "engine/items/InventoryItem";
import Inventory from "engine/player/Inventory";
import PlayerArm from "engine/player/PlayerArm";

const HELD_SIZE = 0.45;
const HELD_FLAT_SIZE = 0.42;
// Offset from the arm's hand to where the item is gripped, applied along the
// camera basis so the item sits in the hand rather than at the very tip.
const GRIP_OFFSET_FORWARD = 0.05;
const GRIP_OFFSET_UP = 0.1;

export default class HeldItem extends Component {
    private mesh: THREE.Mesh | null = null;
    private camera!: THREE.PerspectiveCamera;
    private inventory!: Inventory;
    private playerArm!: PlayerArm;
    private boxGeometry!: THREE.BoxGeometry;
    private flatGeometry!: THREE.PlaneGeometry;
    private currentItem: InventoryItemStack | null = null;
    private isFlatMesh = false;

    // Pre-allocated scratch vectors to avoid per-frame allocation.
    private readonly scratchForward = new THREE.Vector3();
    private readonly worldUp = new THREE.Vector3(0, 1, 0);

    // Quaternion tilt applied on top of camera rotation for flat (item) sprites.
    // Precomputed once so update() doesn't allocate or chain quaternion ops each frame.
    private readonly flatTiltQuaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 10, 0, -Math.PI / 8),
    );

    // Arrow-function fields so the same reference can be passed to both subscribe and unsubscribe.
    private readonly onInventoryChanged = () => this.syncMesh();
    private readonly onHotbarSelectionChanged = (_slot: number) => this.syncMesh();

    start() {
        this.camera = game.camera.threeCamera;
        this.inventory = this.gameObject.getComponent(Inventory);
        this.playerArm = this.gameObject.getComponent(PlayerArm);

        this.boxGeometry = new THREE.BoxGeometry(HELD_SIZE, HELD_SIZE, HELD_SIZE);
        const boxVertexCount = this.boxGeometry.attributes.position.count;
        const boxLightArray = new Float32Array(boxVertexCount).fill(MAX_LIGHT);
        this.boxGeometry.setAttribute("aLight", new THREE.BufferAttribute(boxLightArray, 1));

        this.flatGeometry = new THREE.PlaneGeometry(HELD_FLAT_SIZE, HELD_FLAT_SIZE);
        const flatVertexCount = this.flatGeometry.attributes.position.count;
        const flatLightArray = new Float32Array(flatVertexCount).fill(MAX_LIGHT);
        this.flatGeometry.setAttribute("aLight", new THREE.BufferAttribute(flatLightArray, 1));

        eventManager.subscribe("inventoryChanged", this.onInventoryChanged);
        eventManager.subscribe("hotbarSelectionChanged", this.onHotbarSelectionChanged);

        this.syncMesh();
    }

    update(_deltaTime: number) {
        if (!this.mesh) {
            return;
        }

        this.camera.getWorldDirection(this.scratchForward);

        // Anchor the item to the arm's hand so it reads as gripped rather than
        // floating, then nudge it forward/up so it rests in the hand.
        this.playerArm.getHandWorldPosition(this.mesh.position);
        this.mesh.position
            .addScaledVector(this.scratchForward, GRIP_OFFSET_FORWARD)
            .addScaledVector(this.worldUp, GRIP_OFFSET_UP);

        this.mesh.rotation.copy(this.camera.rotation);

        if (this.isFlatMesh) {
            // Tilt the sprite so it reads as a held object rather than a floating card.
            this.mesh.quaternion.multiply(this.flatTiltQuaternion);
        }
    }

    dispose() {
        eventManager.unsubscribe("inventoryChanged", this.onInventoryChanged);
        eventManager.unsubscribe("hotbarSelectionChanged", this.onHotbarSelectionChanged);
        if (this.mesh) {
            game.threeScene.remove(this.mesh);
            this.mesh = null;
        }
        this.boxGeometry.dispose();
        this.flatGeometry.dispose();
    }

    private syncMesh(): void {
        const slot = this.inventory.getSlot(this.inventory.selectedHotbarSlot);
        const newItem = slot ? slot.item : null;

        if (itemStacksEqual(this.currentItem, newItem)) {
            return;
        }

        if (this.mesh) {
            game.threeScene.remove(this.mesh);
            this.mesh = null;
        }

        this.currentItem = newItem;

        if (newItem === null) {
            return;
        }

        if (newItem.kind === "block") {
            // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z.
            let materials: THREE.Material[];
            if (newItem.type === BlockType.CraftingTable) {
                const ctSide = TextureManager.getCraftingTableMaterial(1, 0, 0);
                const ctTop = TextureManager.getCraftingTableMaterial(0, 1, 0);
                const ctBack = TextureManager.getCraftingTableMaterial(0, 0, 1);
                const ctFront = TextureManager.getCraftingTableMaterial(0, 0, -1);
                materials = [ctSide, ctSide, ctTop, ctSide, ctBack, ctFront];
            } else {
                // Only the +Y face (index 2) uses the top-face texture variant.
                const sideMaterial = TextureManager.getMaterial(newItem.type, 0);
                const topMaterial = TextureManager.getMaterial(newItem.type, 1);
                materials = [sideMaterial, sideMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial];
            }
            this.mesh = new THREE.Mesh(this.boxGeometry, materials);
            this.isFlatMesh = false;
        } else {
            // Non-block items (e.g. coal) are rendered as flat sprites.
            this.mesh = new THREE.Mesh(this.flatGeometry, TextureManager.getFlatItemMaterial(newItem.type));
            this.isFlatMesh = true;
        }
        // Frustum culling is based on the bounding sphere in world space, which is never updated
        // for a mesh that moves every frame — disable it to prevent spurious disappearance.
        this.mesh.frustumCulled = false;
        game.threeScene.add(this.mesh);
    }
}
