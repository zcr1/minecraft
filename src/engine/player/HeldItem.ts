import * as THREE from "three";
import game from "engine/Game";
import TextureManager from "engine/TextureManager";
import { BlockType } from "engine/block/BlockType";
import { MAX_LIGHT } from "engine/chunk/LightingSystem";
import Component from "engine/core/Component";
import eventManager from "engine/core/EventManager";
import { type InventoryItemStack, itemStacksEqual } from "engine/items/InventoryItem";
import { ItemType } from "engine/items/ItemType";
import VoxelItemMeshes from "engine/items/VoxelItemMeshes";
import Inventory from "engine/player/Inventory";
import PlayerArm from "engine/player/PlayerArm";

const HELD_SIZE = 0.45;
const HELD_ITEM_SCALE = 1.5;
const HELD_TOOL_SCALE = 2.5;
// Offset from the arm's hand to where the item is gripped, applied along the
// camera basis so the item sits in the hand rather than at the very tip.
const GRIP_OFFSET_FORWARD = 0.05;
const GRIP_OFFSET_UP = 0.1;
const TOOL_GRIP_OFFSET = 0.22;

// Tools (swords, pickaxes) are drawn as a diagonal handle→head sprite. Held like a real tool they
// should point forward into the scene rather than face the camera flat, so they get their own tilt.
const TOOL_ITEM_TYPES = new Set<ItemType>([
    ItemType.WoodenPickaxe,
    ItemType.StonePickaxe,
    ItemType.WoodenSword,
    ItemType.StoneSword,
]);

export default class HeldItem extends Component {
    private mesh: THREE.Mesh | null = null;
    private camera!: THREE.PerspectiveCamera;
    private inventory!: Inventory;
    private playerArm!: PlayerArm;
    private boxGeometry!: THREE.BoxGeometry;
    private currentItem: InventoryItemStack | null = null;
    // Tilt applied on top of camera rotation in update(), or null for blocks (upright cubes don't
    // tilt). Points at the generic-item or tool tilt depending on the held item.
    private itemTilt: THREE.Quaternion | null = null;
    // Extra downward grip offset (world-up units) for the current item, so tools hang lower.
    private gripOffsetDown = 0;

    // Pre-allocated scratch vectors to avoid per-frame allocation.
    private readonly scratchForward = new THREE.Vector3();
    private readonly scratchUp = new THREE.Vector3();

    // Tilt for flat-ish items (coal, stick, torch): a small lean so they read as held rather than
    // as a card facing the camera. Precomputed once so update() doesn't allocate each frame.
    private readonly itemTiltQuaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 10, 0, -Math.PI / 8),
    );

    // Tilt for tools (swords, pickaxes): rotate ~90° around Y so the diagonal blade points forward
    // into the scene (edge-on to the camera) plus a roll so the handle sits low in the hand.
    private readonly toolTiltQuaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 12, -Math.PI / 2, Math.PI / 8),
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

        eventManager.subscribe("inventoryChanged", this.onInventoryChanged);
        eventManager.subscribe("hotbarSelectionChanged", this.onHotbarSelectionChanged);

        this.syncMesh();
    }

    update(_deltaTime: number) {
        if (!this.mesh) {
            return;
        }

        this.camera.getWorldDirection(this.scratchForward);
        this.scratchUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);

        // Anchor the item to the arm's hand so it reads as gripped rather than
        // floating, then nudge it forward/up (in camera space) so it rests in the hand.
        this.playerArm.getHandWorldPosition(this.mesh.position);
        this.mesh.position
            .addScaledVector(this.scratchForward, GRIP_OFFSET_FORWARD)
            .addScaledVector(this.scratchUp, GRIP_OFFSET_UP + this.gripOffsetDown);

        this.mesh.rotation.copy(this.camera.rotation);

        if (this.itemTilt) {
            this.mesh.quaternion.multiply(this.itemTilt);
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
            this.itemTilt = null;
            this.gripOffsetDown = 0;
        } else {
            // Non-block items render as voxelized 3D meshes (geometry built at boot). Tools are
            // scaled up more, hang lower in the hand, and get their own gripped tilt.
            const isTool = TOOL_ITEM_TYPES.has(newItem.type);
            this.mesh = new THREE.Mesh(VoxelItemMeshes.getGeometry(newItem.type), VoxelItemMeshes.getMaterial());
            this.mesh.scale.setScalar(isTool ? HELD_TOOL_SCALE : HELD_ITEM_SCALE);
            this.itemTilt = isTool ? this.toolTiltQuaternion : this.itemTiltQuaternion;
            this.gripOffsetDown = isTool ? TOOL_GRIP_OFFSET : 0;
        }
        // Frustum culling is based on the bounding sphere in world space, which is never updated
        // for a mesh that moves every frame — disable it to prevent spurious disappearance.
        this.mesh.frustumCulled = false;
        game.threeScene.add(this.mesh);
    }
}
