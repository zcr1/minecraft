import * as THREE from "three";

import Component from "engine/core/Component";
import InputManager from "engine/input/InputManager";
import ChunkManager from "engine/components/ChunkManager";
import ChunkComponent, { BlockType } from "engine/components/ChunkComponent";

export default class DebugClicker extends Component {
    private readonly raycaster = new THREE.Raycaster();
    private readonly pointer = new THREE.Vector2();
    private readonly camera: THREE.Camera;
    private readonly chunkManager: ChunkManager;

    constructor(camera: THREE.Camera, chunkManager: ChunkManager) {
        super();
        this.camera = camera;
        this.chunkManager = chunkManager;
    }

    update() {
        if (!InputManager.instance.wasMousePressed(0)) {
            return;
        }

        const { x, y } = InputManager.instance.mouseNDC;
        this.pointer.set(x, y);
        this.raycaster.setFromCamera(this.pointer, this.camera);

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

        chunk.setBlock(Math.round(local.x), Math.round(local.y), Math.round(local.z), BlockType.Air);
        chunk.rebuild();
    }
}
