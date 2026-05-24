import * as THREE from "three";
import game from "engine/Game";
import Component from "engine/core/Component";
import eventManager from "engine/core/EventManager";
import { ItemType } from "engine/items/ItemType";
import Inventory from "engine/player/Inventory";

// Warm amber color matching a real torch flame.
const TORCH_LIGHT_COLOR = 0xffaa44;
const TORCH_LIGHT_INTENSITY = 3.0;
// Hard cutoff at 14 world units — matches the block-light propagation radius.
const TORCH_LIGHT_DISTANCE = 14;
// Inverse-square falloff for a realistic warm pool of light.
const TORCH_LIGHT_DECAY = 2;

export default class TorchLight extends Component {
    private pointLight!: THREE.PointLight;
    private inventory!: Inventory;
    private isHoldingTorch = false;

    private readonly onInventoryChanged = () => this.syncLightState();
    private readonly onHotbarSelectionChanged = (_slot: number) => this.syncLightState();

    start() {
        this.inventory = this.gameObject.getComponent(Inventory);

        this.pointLight = new THREE.PointLight(TORCH_LIGHT_COLOR, 0, TORCH_LIGHT_DISTANCE, TORCH_LIGHT_DECAY);
        this.pointLight.castShadow = false;
        game.threeScene.add(this.pointLight);

        eventManager.subscribe("inventoryChanged", this.onInventoryChanged);
        eventManager.subscribe("hotbarSelectionChanged", this.onHotbarSelectionChanged);

        this.syncLightState();
    }

    update(_deltaTime: number) {
        if (!this.isHoldingTorch) {
            return;
        }
        this.pointLight.position.copy(game.camera.threeCamera.position);
    }

    dispose() {
        eventManager.unsubscribe("inventoryChanged", this.onInventoryChanged);
        eventManager.unsubscribe("hotbarSelectionChanged", this.onHotbarSelectionChanged);
        game.threeScene.remove(this.pointLight);
    }

    private syncLightState(): void {
        const slot = this.inventory.getSlot(this.inventory.selectedHotbarSlot);
        this.isHoldingTorch = slot !== null && slot.item.kind === "item" && slot.item.type === ItemType.Torch;
        this.pointLight.intensity = this.isHoldingTorch ? TORCH_LIGHT_INTENSITY : 0;
    }
}
