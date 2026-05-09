import Component from "../core/Component";
import InputManager from "../input/InputManager";
import type Transform from "./Transform";

export default class PlayerController extends Component {
    private readonly transform: Transform;
    private readonly speed: number;

    constructor(transform: Transform, speed = 5) {
        super();
        this.transform = transform;
        this.speed = speed;
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

        // Normalize diagonal
        if (deltaX !== 0 && deltaZ !== 0) {
            const inv = 1 / Math.sqrt(2);
            deltaX *= inv;
            deltaZ *= inv;
        }

        this.transform.x += deltaX * this.speed * deltaTime;
        this.transform.z += deltaZ * this.speed * deltaTime;
    }
}
