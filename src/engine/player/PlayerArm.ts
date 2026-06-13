import * as THREE from "three";
import game from "engine/Game";
import { MAX_LIGHT } from "engine/chunk/LightingSystem";
import Component from "engine/core/Component";

const ARM_WIDTH = 0.24;
const ARM_HEIGHT = 0.6;
const ARM_DEPTH = 0.24;
const ARM_OFFSET_FORWARD = 0.45;
const ARM_OFFSET_RIGHT = 0.38;
const ARM_OFFSET_DOWN = -0.55;

export default class PlayerArm extends Component {
    private mesh!: THREE.Mesh;
    private camera!: THREE.PerspectiveCamera;
    private geometry!: THREE.BoxGeometry;
    private material!: THREE.MeshStandardMaterial;

    private readonly scratchForward = new THREE.Vector3();
    private readonly scratchRight = new THREE.Vector3();
    private readonly worldUp = new THREE.Vector3(0, 1, 0);

    private readonly tiltQuaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 5, 0, Math.PI / 12),
    );

    start() {
        this.camera = game.camera.threeCamera;

        this.geometry = new THREE.BoxGeometry(ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH);
        const vertexCount = this.geometry.attributes.position.count;
        const lightArray = new Float32Array(vertexCount).fill(MAX_LIGHT);
        this.geometry.setAttribute("aLight", new THREE.BufferAttribute(lightArray, 1));

        this.material = new THREE.MeshStandardMaterial({ color: 0xc68642, roughness: 0.9 });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        game.threeScene.add(this.mesh);
    }

    update(_deltaTime: number) {
        this.camera.getWorldDirection(this.scratchForward);
        this.scratchRight.crossVectors(this.scratchForward, this.worldUp).normalize();

        this.mesh.position
            .copy(this.camera.position)
            .addScaledVector(this.scratchForward, ARM_OFFSET_FORWARD)
            .addScaledVector(this.scratchRight, ARM_OFFSET_RIGHT)
            .addScaledVector(this.worldUp, ARM_OFFSET_DOWN);

        this.mesh.rotation.copy(this.camera.rotation);
        this.mesh.quaternion.multiply(this.tiltQuaternion);
    }

    dispose() {
        game.threeScene.remove(this.mesh);
        this.geometry.dispose();
        this.material.dispose();
    }
}
