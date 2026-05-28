import * as THREE from "three";
import game from "engine/Game";
import textureManager from "engine/TextureManager";
import { isInstantBreak } from "engine/chunk/ChunkComponent";
import Component from "engine/core/Component";
import PlayerBlockInteraction from "engine/player/PlayerBlockInteraction";
import GameObjectName from "engine/utils/gameObjectNames";

const OVERLAY_SIZE = 1.001;

export default class BlockDamageOverlay extends Component {
    private mesh!: THREE.Mesh;
    private geometry!: THREE.BoxGeometry;
    private material!: THREE.MeshBasicMaterial;
    private playerInteraction!: PlayerBlockInteraction;

    start() {
        this.geometry = new THREE.BoxGeometry(OVERLAY_SIZE, OVERLAY_SIZE, OVERLAY_SIZE);
        this.material = textureManager.createBlockBreakMaterial();
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.visible = false;
        game.threeScene.add(this.mesh);
        this.playerInteraction = game.getGameObject(GameObjectName.Player).getComponent(PlayerBlockInteraction);
    }

    update() {
        const target = this.playerInteraction.targetedBlock;
        if (!target || this.playerInteraction.damageProgress <= 0 || isInstantBreak(target.blockType)) {
            this.mesh.visible = false;
            return;
        }

        const chunkPosition = target.chunk.mesh.position;
        this.mesh.position.set(
            chunkPosition.x + target.blockX,
            chunkPosition.y + target.blockY,
            chunkPosition.z + target.blockZ,
        );
        textureManager.setBlockBreakStage(this.material, this.playerInteraction.damageStage);
        this.mesh.visible = true;
    }

    dispose() {
        game.threeScene.remove(this.mesh);
        this.geometry.dispose();
        this.material.dispose();
    }
}
