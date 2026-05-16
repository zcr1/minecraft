import * as THREE from "three";
import game from "engine/Game";
import ChunkComponent, { BlockType } from "engine/chunk/ChunkComponent";
import ChunkManager from "engine/chunk/ChunkManager";
import Component from "engine/core/Component";
import input from "engine/input/Input";
import GameObjectName from "engine/utils/gameObjectNames";

export default class DebugClicker extends Component {
    private readonly raycaster = new THREE.Raycaster();
    private readonly pointer = new THREE.Vector2();
    private readonly camera: THREE.Camera;
    private chunkManager!: ChunkManager;

    constructor(camera: THREE.Camera) {
        super();
        this.camera = camera;
    }

    start() {
        this.chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);
    }

    update() {
        if (!input.wasMousePressed(0)) {
            return;
        }

        const { x, y } = input.mouseNDC;
        this.pointer.set(x, y);
        this.raycaster.setFromCamera(this.pointer, this.camera);

        // todo refactor inneficient we are checking every mesh
        const meshes = this.chunkManager.getChunks().map(c => c.mesh);
        const hits = this.raycaster.intersectObjects(meshes, true);
        if (!hits.length) {
            return;
        }

        const hit = hits[0];
        // step 0.5 inside the face so Math.round lands on the block's integer-coordinate center
        const local = hit.point.clone().addScaledVector(hit.face!.normal, -0.5).sub(hit.object.parent!.position);

        const chunk = hit.object.parent?.userData.chunk as ChunkComponent | undefined;
        if (!chunk) {
            return;
        }

        const blockX = Math.round(local.x);
        const blockY = Math.round(local.y);
        const blockZ = Math.round(local.z);

        if (chunk.getBlock(blockX, blockY, blockZ) === BlockType.Bedrock) {
            return;
        }

        chunk.setBlock(blockX, blockY, blockZ, BlockType.Air);
        chunk.rebuild();
    }
}
