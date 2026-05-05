import * as THREE from "three";

import Component from "../core/Component";

export default class MeshComponent extends Component {
    readonly mesh: THREE.Mesh;

    constructor(mesh: THREE.Mesh) {
        super();
        this.mesh = mesh;
    }

    update() {
        // this.mesh.rotation.x += 0.01;
        // this.mesh.rotation.y += 0.01;
    }
}
