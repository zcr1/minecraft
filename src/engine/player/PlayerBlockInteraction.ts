import * as THREE from "three";
import game from "engine/Game";
import ChunkComponent, { BlockType } from "engine/chunk/ChunkComponent";
import ChunkManager from "engine/chunk/ChunkManager";
import Component from "engine/core/Component";
import input from "engine/input/Input";
import GameObjectName from "engine/utils/gameObjectNames";

const RAY_DISTANCE = 4;

export interface TargetedBlock {
    chunk: ChunkComponent;
    blockX: number;
    blockY: number;
    blockZ: number;
    blockType: BlockType;
}

export default class PlayerBlockInteraction extends Component {
    private chunkManager!: ChunkManager;
    private readonly raycaster = new THREE.Raycaster();
    private readonly pointer = new THREE.Vector2(0, 0);
    private camera!: THREE.Camera;

    targetedBlock: TargetedBlock | null = null;

    constructor() {
        super();
        this.raycaster.far = RAY_DISTANCE;
    }

    start() {
        this.camera = game.camera.threeCamera;
        this.chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);
    }

    update() {
        if (!input.wasMousePressed(0)) {
            return;
        }

        this.raycaster.setFromCamera(this.pointer, this.camera);

        const chunks = this.chunkManager.getChunksAlongRay(
            this.raycaster.ray.origin,
            this.raycaster.ray.direction,
            RAY_DISTANCE,
        );
        const meshes = chunks.map(chunk => chunk.mesh);
        const hits = this.raycaster.intersectObjects(meshes, true);
        if (!hits.length) {
            this.targetedBlock = null;
            return;
        }

        const hit = hits[0];
        const chunk = hit.object.parent?.userData.chunk as ChunkComponent | undefined;
        if (!chunk) {
            this.targetedBlock = null;
            return;
        }

        // step 0.5 inside the face so Math.round lands on the block's integer-coordinate center
        const local = hit.point.clone().addScaledVector(hit.face!.normal, -0.5).sub(hit.object.parent!.position);
        const blockX = Math.round(local.x);
        const blockY = Math.round(local.y);
        const blockZ = Math.round(local.z);

        this.targetedBlock = {
            chunk,
            blockX,
            blockY,
            blockZ,
            blockType: chunk.getBlock(blockX, blockY, blockZ),
        };
    }
}
