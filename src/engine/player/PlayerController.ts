import Component from "../core/Component";
import input from "../input/Input";
import PlayerCamera from "./PlayerCamera";
import PlayerPhysics from "./PlayerPhysics";

const SPEED = 5;
const JUMP_SPEED = 8;

export default class PlayerController extends Component {
    private readonly speed: number;
    private playerCamera!: PlayerCamera;
    private playerPhysics!: PlayerPhysics;

    constructor() {
        super();
        this.speed = SPEED;
    }

    start() {
        this.playerCamera = this.gameObject.getComponent(PlayerCamera);
        this.playerPhysics = this.gameObject.getComponent(PlayerPhysics);
    }

    update() {
        this.handleMovement();
    }

    handleMovement() {
        let deltaX = 0;
        let deltaZ = 0;

        if (input.isHeld("KeyW")) deltaZ -= 1;
        if (input.isHeld("KeyS")) deltaZ += 1;
        if (input.isHeld("KeyA")) deltaX -= 1;
        if (input.isHeld("KeyD")) deltaX += 1;

        if (input.isHeld("Space")) {
            if (this.playerPhysics.isGrounded) {
                this.playerPhysics.velocity.y = JUMP_SPEED;
            }
        }

        // Prevents diagonal movement from being faster
        if (deltaX !== 0 && deltaZ !== 0) {
            const inv = 1 / Math.sqrt(2);
            deltaX *= inv;
            deltaZ *= inv;
        }

        const yaw = this.playerCamera?.yaw ?? 0;
        const worldDeltaX = deltaZ * Math.sin(yaw) + deltaX * Math.cos(yaw);
        const worldDeltaZ = deltaZ * Math.cos(yaw) - deltaX * Math.sin(yaw);

        this.playerPhysics.velocity.x = worldDeltaX * this.speed;
        this.playerPhysics.velocity.z = worldDeltaZ * this.speed;
    }
}
