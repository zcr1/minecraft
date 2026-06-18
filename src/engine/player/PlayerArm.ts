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
import input from "engine/input/Input";
import Inventory from "engine/player/Inventory";
import { applyVertexLighting } from "engine/renderer/applyVertexLighting";

const ARM_WIDTH = 0.24;
const ARM_HEIGHT = 1;
const ARM_DEPTH = 0.24;

const SWING_DURATION_SECONDS = 0.3;
// Peak swing displacement, in camera-basis units, and the shoulder pitch in
// radians. Tune these to dial in the feel.
const SWING_FORWARD = 0.18;
const SWING_DOWN = 0.22;
const SWING_RIGHT = 0.06;
const SWING_PITCH = Math.PI / 6;

interface ArmPose {
    readonly offsetForward: number;
    readonly offsetRight: number;
    readonly offsetDown: number;
    readonly tilt: THREE.Quaternion;
    // Scale applied along the arm's length (local Y), shrinking it toward its
    // center. Also pulls the hand closer to the player.
    readonly lengthScale: number;
}

// Relaxed pose used when the hand is empty — arm hangs down and forward.
const EMPTY_POSE: ArmPose = {
    offsetForward: 0.45,
    offsetRight: 0.38,
    offsetDown: -0.8,
    tilt: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 5, 0, Math.PI / 12)),
    lengthScale: 1,
};

// Grip pose used when holding an item — forearm raised, angled forward and
// shortened so the hand sits in front of the player to hold the item.
const HOLDING_POSE: ArmPose = {
    offsetForward: 0.5,
    offsetRight: 0.34,
    offsetDown: -0.5,
    tilt: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2.4, 0, Math.PI / 12)),
    lengthScale: 0.6,
};

export default class PlayerArm extends Component {
    private mesh!: THREE.Mesh;
    private camera!: THREE.PerspectiveCamera;
    private geometry!: THREE.BoxGeometry;
    private materials!: THREE.MeshStandardMaterial[];
    private inventory!: Inventory;

    private readonly scratchForward = new THREE.Vector3();
    private readonly scratchRight = new THREE.Vector3();
    private readonly scratchPosition = new THREE.Vector3();
    private readonly scratchQuaternion = new THREE.Quaternion();
    private readonly scratchSwingQuaternion = new THREE.Quaternion();
    private readonly worldUp = new THREE.Vector3(0, 1, 0);
    private readonly localXAxis = new THREE.Vector3(1, 0, 0);

    // Swing animation state. swingProgress runs 0→1 over one arc; while the mine
    // button stays held the swing loops continuously.
    private swingProgress = 0;
    private isSwinging = false;

    // Local-space position of the hand (the +Y end of the arm box), where a
    // held item is gripped.
    private readonly handLocalOffset = new THREE.Vector3(0, ARM_HEIGHT / 2, 0);

    start() {
        this.camera = game.camera.threeCamera;
        this.inventory = this.gameObject.getComponent(Inventory);

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

    update(deltaTime: number) {
        this.updateSwing(deltaTime);
        const pose = this.currentPose();
        this.computeTransform(pose, this.mesh.position, this.mesh.quaternion);
        this.mesh.scale.set(1, pose.lengthScale, 1);
    }

    /**
     * Advances the swing animation. A left/right click starts a one-shot arc;
     * holding the mine button loops the arc continuously, matching Minecraft.
     */
    private updateSwing(deltaTime: number): void {
        if (input.wasMousePressed(0) || input.wasMousePressed(2)) {
            this.isSwinging = true;
            this.swingProgress = 0;
        }

        if (!this.isSwinging) {
            return;
        }

        this.swingProgress += deltaTime / SWING_DURATION_SECONDS;
        if (this.swingProgress >= 1) {
            if (input.isMouseHeld(0)) {
                // Keep the remainder so continuous mining stays smooth.
                this.swingProgress -= 1;
            } else {
                this.swingProgress = 0;
                this.isSwinging = false;
            }
        }
    }

    /**
     * World-space position of the hand where a held item should be anchored.
     * Recomputed from the camera so it is consistent within a frame regardless
     * of component update order.
     */
    getHandWorldPosition(target: THREE.Vector3): THREE.Vector3 {
        const pose = this.currentPose();
        this.computeTransform(pose, this.scratchPosition, this.scratchQuaternion);
        return target
            .copy(this.handLocalOffset)
            .multiplyScalar(pose.lengthScale)
            .applyQuaternion(this.scratchQuaternion)
            .add(this.scratchPosition);
    }

    dispose() {
        game.threeScene.remove(this.mesh);
        this.geometry.dispose();
        for (const material of this.materials) {
            material.map?.dispose();
            material.dispose();
        }
    }

    private currentPose(): ArmPose {
        const slot = this.inventory.getSlot(this.inventory.selectedHotbarSlot);
        return slot && slot.item ? HOLDING_POSE : EMPTY_POSE;
    }

    private computeTransform(pose: ArmPose, outPosition: THREE.Vector3, outQuaternion: THREE.Quaternion): void {
        this.camera.getWorldDirection(this.scratchForward);
        this.scratchRight.crossVectors(this.scratchForward, this.worldUp).normalize();

        outPosition
            .copy(this.camera.position)
            .addScaledVector(this.scratchForward, pose.offsetForward)
            .addScaledVector(this.scratchRight, pose.offsetRight)
            .addScaledVector(this.worldUp, pose.offsetDown);

        outQuaternion.copy(this.camera.quaternion).multiply(pose.tilt);

        if (this.isSwinging) {
            // Two sine curves: a symmetric arc and a sharper "attack" that rises
            // fast and eases back, giving the swing its punchy feel.
            const arc = Math.sin(this.swingProgress * Math.PI);
            const attack = Math.sin(Math.sqrt(this.swingProgress) * Math.PI);
            const wobble = Math.sin(Math.sqrt(this.swingProgress) * Math.PI * 2);

            outPosition
                .addScaledVector(this.scratchForward, SWING_FORWARD * arc)
                .addScaledVector(this.worldUp, -SWING_DOWN * attack)
                .addScaledVector(this.scratchRight, SWING_RIGHT * wobble);

            // Pitch the forearm down/forward at the shoulder, in arm-local space.
            this.scratchSwingQuaternion.setFromAxisAngle(this.localXAxis, -SWING_PITCH * attack);
            outQuaternion.multiply(this.scratchSwingQuaternion);
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
