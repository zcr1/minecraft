import Component from "../core/Component";
import InputManager from "../input/InputManager";
import type Transform from "./Transform";
import type PlayerCamera from "./PlayerCamera";

export default class PlayerController extends Component {
    private readonly transform: Transform;
    private readonly speed: number;
    private readonly playerCamera: PlayerCamera | undefined;

    constructor(transform: Transform, speed = 5, playerCamera?: PlayerCamera) {
        super();
        this.transform = transform;
        this.speed = speed;
        this.playerCamera = playerCamera;
    }

    update(deltaTime: number) {
        this.handleMovement(deltaTime);
    }

    handleMovement(deltaTime: number) {
        const input = InputManager.instance;
        let deltaX = 0;
        let deltaZ = 0;

        if (input.isHeld("KeyW")) deltaZ -= 1;
        if (input.isHeld("KeyS")) deltaZ += 1;
        if (input.isHeld("KeyA")) deltaX -= 1;
        if (input.isHeld("KeyD")) deltaX += 1;

        if (deltaX !== 0 && deltaZ !== 0) {
            const inv = 1 / Math.sqrt(2);
            deltaX *= inv;
            deltaZ *= inv;
        }

        const yaw = this.playerCamera?.yaw ?? 0;
        const worldDeltaX = deltaZ * Math.sin(yaw) + deltaX * Math.cos(yaw);
        const worldDeltaZ = deltaZ * Math.cos(yaw) - deltaX * Math.sin(yaw);

        this.transform.x += worldDeltaX * this.speed * deltaTime;
        this.transform.z += worldDeltaZ * this.speed * deltaTime;
    }
}
