import * as THREE from "three";
import Transform from "engine/components/Transform";
import type Camera from "../core/Camera";
import Component from "../core/Component";
import input from "../input/Input";

const ROTATE_SPEED = 0.002;
const EYE_OFFSET = 0.65;
const PITCH_LIMIT = Math.PI / 2 - 0.01;

const MOVEMENT_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "Space"];

export default class PlayerCamera extends Component {
    private readonly cam: THREE.PerspectiveCamera;
    private readonly canvas: HTMLCanvasElement;
    private _yaw = 0;
    private _pitch = 0;
    private pointerLocked = false;
    private playerTransform!: Transform;

    private readonly onCanvasClick: () => void;
    private readonly onPointerLockChange: () => void;
    private readonly onKeyDown: (event: KeyboardEvent) => void;

    constructor(camera: Camera, canvas: HTMLCanvasElement) {
        super();
        this.cam = camera.threeCamera;
        this.cam.rotation.order = "YXZ";
        this.canvas = canvas;

        this.onCanvasClick = () => {
            try {
                canvas.requestPointerLock();
            } catch {}
        };
        this.onKeyDown = (event: KeyboardEvent) => {
            if (!this.pointerLocked && MOVEMENT_KEYS.includes(event.code)) {
                try {
                    canvas.requestPointerLock();
                } catch {}
            }
        };
        this.onPointerLockChange = () => {
            this.pointerLocked = document.pointerLockElement === canvas;
            if (this.pointerLocked && document.activeElement instanceof HTMLElement) {
                // Blurs debug menu
                document.activeElement.blur();
            }
        };

        canvas.addEventListener("click", this.onCanvasClick);
        document.addEventListener("pointerlockchange", this.onPointerLockChange);
        document.addEventListener("keydown", this.onKeyDown);
    }

    start() {
        this.playerTransform = this.gameObject.getComponent(Transform);
    }

    get yaw(): number {
        return this._yaw;
    }

    set yaw(value: number) {
        this._yaw = value;
    }

    get pitch(): number {
        return this._pitch;
    }

    set pitch(value: number) {
        this._pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, value));
    }

    update(_deltaTime: number) {
        if (this.pointerLocked) {
            this._yaw -= input.mouseDeltaX * ROTATE_SPEED;
            this._pitch -= input.mouseDeltaY * ROTATE_SPEED;
            this._pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this._pitch));
        }

        this.cam.rotation.y = this._yaw;
        this.cam.rotation.x = this._pitch;
        this.cam.position.set(this.playerTransform.x, this.playerTransform.y + EYE_OFFSET, this.playerTransform.z);
    }

    dispose() {
        this.canvas.removeEventListener("click", this.onCanvasClick);
        document.removeEventListener("pointerlockchange", this.onPointerLockChange);
        document.removeEventListener("keydown", this.onKeyDown);
    }
}
