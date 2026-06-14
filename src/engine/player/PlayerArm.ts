import armBackUrl from "assets/textures/player/player_arm_back.png";
import armBottomUrl from "assets/textures/player/player_arm_bottom.png";
import armFrontUrl from "assets/textures/player/player_arm_front.png";
import armLeftUrl from "assets/textures/player/player_arm_left.png";
import armRightUrl from "assets/textures/player/player_arm_right.png";
import armTopUrl from "assets/textures/player/player_arm_top.png";
import * as THREE from "three";
import game from "engine/Game";
import { MAX_LIGHT } from "engine/chunk/LightingSystem";
import Component from "engine/core/Component";
import { applyVertexLighting } from "engine/renderer/applyVertexLighting";

const ARM_WIDTH = 0.24;
const ARM_HEIGHT = 1;
const ARM_DEPTH = 0.24;
const ARM_OFFSET_FORWARD = 0.45;
const ARM_OFFSET_RIGHT = 0.38;
const ARM_OFFSET_DOWN = -0.8;

export default class PlayerArm extends Component {
    private mesh!: THREE.Mesh;
    private camera!: THREE.PerspectiveCamera;
    private geometry!: THREE.BoxGeometry;
    private materials!: THREE.MeshStandardMaterial[];

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

        // Flip the textures vertically so the shirt/shoulder maps to the top of
        // the arm and the hand maps to the bottom (they were inverted).
        const uvAttribute = this.geometry.attributes.uv;
        for (let i = 0; i < uvAttribute.count; i++) {
            uvAttribute.setY(i, 1 - uvAttribute.getY(i));
        }
        uvAttribute.needsUpdate = true;

        const loader = new THREE.TextureLoader();
        const frontMat = this.loadMat(loader, armFrontUrl);
        const backMat = this.loadMat(loader, armBackUrl);
        const leftMat = this.loadMat(loader, armLeftUrl);
        const rightMat = this.loadMat(loader, armRightUrl);
        const topMat = this.loadMat(loader, armTopUrl);
        const bottomMat = this.loadMat(loader, armBottomUrl);

        // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
        this.materials = [rightMat, leftMat, bottomMat, topMat, backMat, frontMat];

        this.mesh = new THREE.Mesh(this.geometry, this.materials);
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
        for (const material of this.materials) {
            material.dispose();
        }
    }

    private loadMat(loader: THREE.TextureLoader, url: string): THREE.MeshStandardMaterial {
        const tex = loader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        const material = new THREE.MeshStandardMaterial({ map: tex });
        applyVertexLighting(material);
        return material;
    }
}
