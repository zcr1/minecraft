import * as THREE from "three";
import Component from "../core/Component";
import InputManager from "../input/InputManager";
import type Camera from "../core/Camera";
import Transform from "./Transform";

const ROTATE_SPEED = 0.002;
const EYE_OFFSET = 0.65;
const PITCH_LIMIT = Math.PI / 2 - 0.01;

export default class PlayerCamera extends Component {
    private readonly cam: THREE.PerspectiveCamera;
    private _yaw = 0;
    private pitch = 0;
    private pointerLocked = false;

    constructor(camera: Camera, canvas: HTMLCanvasElement) {
        super();
        this.cam = camera.threeCamera;
        this.cam.rotation.order = "YXZ";

        canvas.addEventListener("click", () => canvas.requestPointerLock());
        document.addEventListener("pointerlockchange", () => {
            this.pointerLocked = document.pointerLockElement === canvas;
        });
    }

    get yaw(): number {
        return this._yaw;
    }

    update(_deltaTime: number) {
        const transform = this.gameObject.getComponent(Transform);

        if (this.pointerLocked) {
            const input = InputManager.instance;
            this._yaw -= input.mouseDeltaX * ROTATE_SPEED;
            this.pitch -= input.mouseDeltaY * ROTATE_SPEED;
            this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
        }

        this.cam.rotation.y = this._yaw;
        this.cam.rotation.x = this.pitch;
        this.cam.position.set(transform.x, transform.y + EYE_OFFSET, transform.z);
    }
}
