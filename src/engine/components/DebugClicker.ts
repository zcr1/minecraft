import * as THREE from "three";

import Component from "engine/core/Component";
import InputManager from "engine/input/InputManager";
import ChunkManager from "engine/components/ChunkManager";
import { BlockType } from "engine/components/ChunkComponent";

export default class DebugClicker extends Component {
    private readonly raycaster = new THREE.Raycaster();
    private readonly camera: THREE.Camera;
    private readonly chunkManager: ChunkManager;
    private readonly materials: [THREE.Material, THREE.Material];

    constructor(camera: THREE.Camera, chunkManager: ChunkManager, materials: [THREE.Material, THREE.Material]) {
        super();
        this.camera = camera;
        this.chunkManager = chunkManager;
        this.materials = materials;
    }

    update() {
        if (!InputManager.instance.wasMousePressed(0)) return;

        const { x, y } = InputManager.instance.mouseNDC;
        this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

        const chunks = this.chunkManager.getChunks();
        const meshes = chunks.map(c => c.mesh);
        const hits = this.raycaster.intersectObjects(meshes, true);
        console.log(hits);
        if (!hits.length) return;

        const hit = hits[0];

        // Step 0.5 units inward along the inverse normal to land inside the block
        const inside = hit.point.clone().addScaledVector(hit.face!.normal, -0.5);

        // Find the chunk whose mesh group is the hit object's ancestor
        const chunk = chunks.find(c => c.mesh === hit.object.parent);
        console.log(chunk);
        if (!chunk) return;

        // Convert world position to local block integer coords
        const local = inside.clone().sub(chunk.mesh.position);
        const bx = Math.round(local.x);
        const by = Math.round(local.y);
        const bz = Math.round(local.z);

        console.log(bx, by, bz);

        chunk.setBlock(bx, by, bz, BlockType.Air);
        chunk.buildMesh(this.materials[0], this.materials[1]);
    }
}
