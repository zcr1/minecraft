import * as THREE from "three";
import game from "../Game";
import ChunkManager from "../chunk/ChunkManager";
import Transform from "../components/Transform";
import Component from "../core/Component";
import { PhysicsBody, applyGravity, stepAxisX, stepAxisY, stepAxisZ } from "../physics/voxelPhysics";
import GameObjectName from "../utils/gameObjectNames";

const GRAVITY = -20;
const TERMINAL_VELOCITY = -30;
export const ZOMBIE_HALF_WIDTH = 0.3;
export const ZOMBIE_HALF_HEIGHT = 0.9;

export default class ZombiePhysics extends Component {
    private transform!: Transform;
    private chunkManager!: ChunkManager;
    private body!: PhysicsBody;
    readonly velocity = new THREE.Vector3();
    isGrounded = false;

    start() {
        this.transform = this.gameObject.getComponent(Transform);
        this.chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);
        this.body = {
            position: this.transform,
            velocity: this.velocity,
            halfWidth: ZOMBIE_HALF_WIDTH,
            halfHeight: ZOMBIE_HALF_HEIGHT,
        };
    }

    update(deltaTime: number) {
        this.isGrounded = false;
        applyGravity(this.body, deltaTime, GRAVITY, TERMINAL_VELOCITY);

        const yHit = stepAxisY(this.body, this.chunkManager, deltaTime);
        if (yHit !== null) {
            this.velocity.y = 0;
            if (yHit === "foot") {
                this.isGrounded = true;
            }
        }

        stepAxisX(this.body, this.chunkManager, deltaTime);
        stepAxisZ(this.body, this.chunkManager, deltaTime);
    }
}
