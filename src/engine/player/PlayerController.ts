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
        if (this.playerPhysics.noClipEnabled) {
            this.handleNoClipMovement();
        } else {
            this.handleGroundedMovement();
        }
    }

    private handleNoClipMovement() {
        let deltaForward = 0;
        let deltaStrafe = 0;

        if (input.isHeld("KeyW")) {
            deltaForward -= 1;
        }
        if (input.isHeld("KeyS")) {
            deltaForward += 1;
        }
        if (input.isHeld("KeyA")) {
            deltaStrafe -= 1;
        }
        if (input.isHeld("KeyD")) {
            deltaStrafe += 1;
        }

        const yaw = this.playerCamera?.yaw ?? 0;
        const pitch = this.playerCamera?.pitch ?? 0;

        // Forward uses full look direction (pitch + yaw); strafe is horizontal only
        const velocityX = deltaForward * Math.sin(yaw) * Math.cos(pitch) + deltaStrafe * Math.cos(yaw);
        const velocityY = deltaForward * -Math.sin(pitch);
        const velocityZ = deltaForward * Math.cos(yaw) * Math.cos(pitch) - deltaStrafe * Math.sin(yaw);

        // Prevent diagonal movement from being faster
        const horizontalLength = Math.sqrt(velocityX * velocityX + velocityZ * velocityZ);
        const scale = horizontalLength > 1 ? 1 / horizontalLength : 1;

        this.playerPhysics.velocity.x = velocityX * scale * this.speed * 2;
        this.playerPhysics.velocity.z = velocityZ * scale * this.speed * 2;
        this.playerPhysics.velocity.y = velocityY * this.speed * 2;
    }

    private handleGroundedMovement() {
        let deltaX = 0;
        let deltaZ = 0;

        if (input.isHeld("KeyW")) {
            deltaZ -= 1;
        }
        if (input.isHeld("KeyS")) {
            deltaZ += 1;
        }
        if (input.isHeld("KeyA")) {
            deltaX -= 1;
        }
        if (input.isHeld("KeyD")) {
            deltaX += 1;
        }

        if (input.isHeld("Space") && this.playerPhysics.isGrounded) {
            this.playerPhysics.velocity.y = JUMP_SPEED;
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
