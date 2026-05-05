import Component from "engine/core/Component";
import InputManager from "engine/input/InputManager";
import * as THREE from "three";
import type Camera from "engine/core/Camera";

interface DebugCameraOptions {
    moveSpeed?: number;
    rotateSpeed?: number;
    panSpeed?: number;
    zoomSpeed?: number;
}

export default class DebugCameraController extends Component {
    private cam: THREE.PerspectiveCamera;
    private moveSpeed: number;
    private rotateSpeed: number;
    private panSpeed: number;
    private zoomSpeed: number;

    private yaw: number;
    private pitch: number;

    private readonly up = new THREE.Vector3(0, 1, 0);
    private readonly forward = new THREE.Vector3();
    private readonly right = new THREE.Vector3();

    constructor(camera: Camera, options: DebugCameraOptions = {}) {
        super();
        this.cam = camera.threeCamera;
        this.moveSpeed = options.moveSpeed ?? 0.3;
        this.rotateSpeed = options.rotateSpeed ?? 0.003;
        this.panSpeed = options.panSpeed ?? 0.005;
        this.zoomSpeed = options.zoomSpeed ?? 0.01;

        this.cam.rotation.order = "YXZ";
        this.yaw = this.cam.rotation.y;
        this.pitch = this.cam.rotation.x;
    }

    update() {
        const input = InputManager.instance;

        if (input.isMouseHeld(2)) {
            this.yaw -= input.mouseDeltaX * this.rotateSpeed;
            this.pitch -= input.mouseDeltaY * this.rotateSpeed;
            this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
        }

        this.cam.rotation.y = this.yaw;
        this.cam.rotation.x = this.pitch;

        this.cam.getWorldDirection(this.forward);
        this.right.crossVectors(this.forward, this.up).normalize();

        if (input.isHeld("KeyW")) this.cam.position.addScaledVector(this.forward, this.moveSpeed);
        if (input.isHeld("KeyS")) this.cam.position.addScaledVector(this.forward, -this.moveSpeed);
        if (input.isHeld("KeyA")) this.cam.position.addScaledVector(this.right, -this.moveSpeed);
        if (input.isHeld("KeyD")) this.cam.position.addScaledVector(this.right, this.moveSpeed);
        if (input.isHeld("KeyQ")) this.cam.position.y -= this.moveSpeed;
        if (input.isHeld("KeyE")) this.cam.position.y += this.moveSpeed;

        if (input.scrollDeltaY !== 0) {
            this.cam.position.addScaledVector(this.forward, -input.scrollDeltaY * this.zoomSpeed);
        }

        if (input.isMouseHeld(1)) {
            this.cam.position.addScaledVector(this.right, -input.mouseDeltaX * this.panSpeed);
            this.cam.position.y += input.mouseDeltaY * this.panSpeed;
        }
    }
}
