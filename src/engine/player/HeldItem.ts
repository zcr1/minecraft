import * as THREE from "three";
import game from "engine/Game";
import TextureManager from "engine/TextureManager";
import { BlockType } from "engine/chunk/ChunkComponent";
import { MAX_LIGHT } from "engine/chunk/LightingSystem";
import Component from "engine/core/Component";
import eventManager from "engine/core/EventManager";
import Inventory from "engine/player/Inventory";

const HELD_SIZE = 0.3;
const HELD_OFFSET_FORWARD = 0.45;
const HELD_OFFSET_RIGHT = 0.3;
const HELD_OFFSET_DOWN = -0.25;

export default class HeldItem extends Component {
    private mesh: THREE.Mesh | null = null;
    private camera!: THREE.PerspectiveCamera;
    private inventory!: Inventory;
    private geometry!: THREE.BoxGeometry;
    private currentBlockType: BlockType | null = null;

    // Pre-allocated scratch vectors to avoid per-frame allocation.
    private readonly scratchForward = new THREE.Vector3();
    private readonly scratchRight = new THREE.Vector3();
    private readonly worldUp = new THREE.Vector3(0, 1, 0);

    // Arrow-function fields so the same reference can be passed to both subscribe and unsubscribe.
    private readonly onInventoryChanged = () => this.syncMesh();
    private readonly onHotbarSelectionChanged = (_slot: number) => this.syncMesh();

    start() {
        this.camera = game.camera.threeCamera;
        this.inventory = this.gameObject.getComponent(Inventory);

        this.geometry = new THREE.BoxGeometry(HELD_SIZE, HELD_SIZE, HELD_SIZE);
        const vertexCount = this.geometry.attributes.position.count;
        const lightArray = new Float32Array(vertexCount).fill(MAX_LIGHT);
        this.geometry.setAttribute("aLight", new THREE.BufferAttribute(lightArray, 1));

        eventManager.subscribe("inventoryChanged", this.onInventoryChanged);
        eventManager.subscribe("hotbarSelectionChanged", this.onHotbarSelectionChanged);

        this.syncMesh();
    }

    update(_deltaTime: number) {
        if (!this.mesh) {
            return;
        }

        this.camera.getWorldDirection(this.scratchForward);
        this.scratchRight.crossVectors(this.scratchForward, this.worldUp).normalize();

        this.mesh.position
            .copy(this.camera.position)
            .addScaledVector(this.scratchForward, HELD_OFFSET_FORWARD)
            .addScaledVector(this.scratchRight, HELD_OFFSET_RIGHT)
            .addScaledVector(this.worldUp, HELD_OFFSET_DOWN);

        this.mesh.rotation.copy(this.camera.rotation);
    }

    dispose() {
        eventManager.unsubscribe("inventoryChanged", this.onInventoryChanged);
        eventManager.unsubscribe("hotbarSelectionChanged", this.onHotbarSelectionChanged);
        if (this.mesh) {
            game.threeScene.remove(this.mesh);
            this.mesh = null;
        }
        this.geometry.dispose();
    }

    private syncMesh(): void {
        const slot = this.inventory.getSlot(this.inventory.selectedHotbarSlot);
        const newBlockType = slot ? slot.blockType : null;

        if (newBlockType === this.currentBlockType) {
            return;
        }

        if (this.mesh) {
            game.threeScene.remove(this.mesh);
            this.mesh = null;
        }

        this.currentBlockType = newBlockType;

        if (newBlockType === null) {
            return;
        }

        // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z.
        // Only the +Y face (index 2) uses the top-face texture variant.
        const sideMaterial = TextureManager.getMaterial(newBlockType, 0);
        const topMaterial = TextureManager.getMaterial(newBlockType, 1);
        const materials = [sideMaterial, sideMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial];
        this.mesh = new THREE.Mesh(this.geometry, materials);
        // Frustum culling is based on the bounding sphere in world space, which is never updated
        // for a mesh that moves every frame — disable it to prevent spurious disappearance.
        this.mesh.frustumCulled = false;
        game.threeScene.add(this.mesh);
    }
}
