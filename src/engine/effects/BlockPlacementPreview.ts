import blockOverlayUrl from "assets/textures/misc/block_overlay.png";
import * as THREE from "three";
import game from "engine/Game";
import { BlockType } from "engine/block/BlockType";
import ChunkManager from "engine/chunk/ChunkManager";
import Transform from "engine/components/Transform";
import Component from "engine/core/Component";
import { ITEM_TO_BLOCK } from "engine/items/ItemType";
import Inventory from "engine/player/Inventory";
import PlayerBlockInteraction from "engine/player/PlayerBlockInteraction";
import { playerOverlapsBlock } from "engine/player/PlayerPhysics";
import GameObjectName from "engine/utils/gameObjectNames";

// Slightly larger than 1 so the overlay sits just outside the block face and avoids z-fighting.
const PREVIEW_SIZE = 1.002;

export default class BlockPlacementPreview extends Component {
    private mesh!: THREE.Mesh;
    private geometry!: THREE.BoxGeometry;
    private material!: THREE.MeshBasicMaterial;
    private playerInteraction!: PlayerBlockInteraction;
    private inventory!: Inventory;
    private chunkManager!: ChunkManager;
    private playerTransform!: Transform;

    start() {
        const playerObject = game.getGameObject(GameObjectName.Player);
        this.playerInteraction = playerObject.getComponent(PlayerBlockInteraction);
        this.inventory = playerObject.getComponent(Inventory);
        this.playerTransform = playerObject.getComponent(Transform);
        this.chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);

        const loader = new THREE.TextureLoader();
        const texture = loader.load(blockOverlayUrl);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;

        this.geometry = new THREE.BoxGeometry(PREVIEW_SIZE, PREVIEW_SIZE, PREVIEW_SIZE);
        this.material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.visible = false;
        game.threeScene.add(this.mesh);
    }

    update(_deltaTime: number) {
        const target = this.playerInteraction.targetedBlock;
        const slot = this.inventory.getSlot(this.inventory.selectedHotbarSlot);

        // Resolve which BlockType would be placed (if any) for the current slot.
        // Items that map to BlockType.Torch are excluded — torches render as cross-quad sprites,
        // so a cube ghost would be misleading.
        const placedBlockType = slot
            ? slot.item.kind === "block"
                ? slot.item.type
                : ITEM_TO_BLOCK[slot.item.type]
            : undefined;

        const canPlace = placedBlockType !== undefined && placedBlockType !== BlockType.Torch;
        if (!target || !canPlace) {
            this.mesh.visible = false;
            return;
        }

        // Water blocks are replaced in-place; all other blocks place on the adjacent face.
        const isWaterTarget = target.blockType === BlockType.Water;
        const normalOffsetX = isWaterTarget ? 0 : this.playerInteraction.hitNormal.x;
        const normalOffsetY = isWaterTarget ? 0 : this.playerInteraction.hitNormal.y;
        const normalOffsetZ = isWaterTarget ? 0 : this.playerInteraction.hitNormal.z;
        const worldX = target.chunk.worldOriginX + target.blockX + normalOffsetX;
        const worldY = target.chunk.worldOriginY + target.blockY + normalOffsetY;
        const worldZ = target.chunk.worldOriginZ + target.blockZ + normalOffsetZ;

        const existingBlock = this.chunkManager.getBlockAtWorld(worldX, worldY, worldZ);
        if (existingBlock !== BlockType.Air && existingBlock !== BlockType.Water) {
            this.mesh.visible = false;
            return;
        }

        if (playerOverlapsBlock(this.playerTransform, worldX, worldY, worldZ)) {
            this.mesh.visible = false;
            return;
        }

        this.mesh.position.set(worldX, worldY, worldZ);
        this.mesh.visible = true;
    }

    dispose() {
        game.threeScene.remove(this.mesh);
        this.geometry.dispose();
        this.material.map?.dispose();
        this.material.dispose();
    }
}
