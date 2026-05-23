import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import game from "engine/Game";
import { BlockType } from "engine/chunk/ChunkComponent";
import ChunkManager from "engine/chunk/ChunkManager";
import Transform from "engine/components/Transform";
import Component from "engine/core/Component";
import Inventory from "engine/player/Inventory";
import PlayerBlockInteraction from "engine/player/PlayerBlockInteraction";
import { playerOverlapsBlock } from "engine/player/PlayerPhysics";
import GameObjectName from "engine/utils/gameObjectNames";

// Slightly larger than 1 so the wireframe sits just outside the block face and avoids z-fighting.
const PREVIEW_SIZE = 1.002;
const LINE_WIDTH_PX = 4;

export default class BlockPlacementPreview extends Component {
    private lines!: LineSegments2;
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

        // Build edge positions from a BoxGeometry, then convert to LineSegmentsGeometry which the
        // fat-line shader requires. EdgesGeometry gives us 12 unique edges with no diagonals.
        const boxGeometry = new THREE.BoxGeometry(PREVIEW_SIZE, PREVIEW_SIZE, PREVIEW_SIZE);
        const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);
        boxGeometry.dispose();

        const lineGeometry = new LineSegmentsGeometry();
        lineGeometry.setPositions(edgesGeometry.attributes.position.array as Float32Array);
        edgesGeometry.dispose();

        const material = new LineMaterial({
            color: 0x000001,
            linewidth: LINE_WIDTH_PX,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
        });

        // LineMaterial needs the viewport size to convert linewidth (pixels) to clip space.
        const canvas = game.renderer.domElement;
        material.resolution.set(canvas.clientWidth, canvas.clientHeight);

        this.lines = new LineSegments2(lineGeometry, material);
        this.lines.visible = false;
        game.threeScene.add(this.lines);
    }

    update(_deltaTime: number) {
        const target = this.playerInteraction.targetedBlock;
        const slot = this.inventory.getSlot(this.inventory.selectedHotbarSlot);

        if (!target || !slot || slot.item.kind !== "block") {
            this.lines.visible = false;
            return;
        }

        const worldX = target.chunk.worldOriginX + target.blockX + this.playerInteraction.hitNormal.x;
        const worldY = target.chunk.worldOriginY + target.blockY + this.playerInteraction.hitNormal.y;
        const worldZ = target.chunk.worldOriginZ + target.blockZ + this.playerInteraction.hitNormal.z;

        if (this.chunkManager.getBlockAtWorld(worldX, worldY, worldZ) !== BlockType.Air) {
            this.lines.visible = false;
            return;
        }

        if (playerOverlapsBlock(this.playerTransform, worldX, worldY, worldZ)) {
            this.lines.visible = false;
            return;
        }

        this.lines.position.set(worldX, worldY, worldZ);
        this.lines.visible = true;
    }

    dispose() {
        game.threeScene.remove(this.lines);
        this.lines.geometry.dispose();
        (this.lines.material as LineMaterial).dispose();
    }
}
