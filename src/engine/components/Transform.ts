import * as THREE from "three";
import Component from "../core/Component";

export default class Transform extends Component {
    x: number;
    y: number;
    z: number;
    private mesh: THREE.Mesh;

    constructor(mesh: THREE.Mesh, x = 0, y = 0, z = 0) {
        super();
        this.mesh = mesh;
        this.x = x;
        this.y = y;
        this.z = z;
        this.mesh.position.set(this.x, this.y, this.z);
    }

    update() {
        this.mesh.position.set(this.x, this.y, this.z);
    }
}
