import * as THREE from "three";
import game from "engine/Game";
import ChunkManager from "engine/chunk/ChunkManager";
import Transform from "engine/components/Transform";
import { PhysicsBody, applyGravity, stepAxisX, stepAxisY, stepAxisZ } from "engine/physics/voxelPhysics";
import GameObjectName from "engine/utils/gameObjectNames";
import Component from "../core/Component";

const GRAVITY = -20;
const TERMINAL_VELOCITY = -30;
const HALF_WIDTH = 0.3;
const HALF_HEIGHT = 0.9;

export default class PlayerPhysics extends Component {
    private transform!: Transform;
    private chunkManager!: ChunkManager;
    private body!: PhysicsBody;
    isGrounded = false;
    velocity = new THREE.Vector3();

    start() {
        this.transform = this.gameObject.getComponent(Transform);
        this.chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);
        this.body = {
            position: this.transform,
            velocity: this.velocity,
            halfWidth: HALF_WIDTH,
            halfHeight: HALF_HEIGHT,
        };
    }

    update(deltaTime: number) {
        // Each axis is stepped and resolved independently so that a wall in one
        // axis can't be mistaken for a collision in another (e.g. a corner block
        // seen via perpendicular AABB straddle triggering an incorrect X snap).
        // Y is resolved first so the player is on solid ground before horizontal
        // collision runs.
        this.isGrounded = false;
        applyGravity(this.body, deltaTime, GRAVITY, TERMINAL_VELOCITY);

        const yHit = stepAxisY(this.body, this.chunkManager, deltaTime);
        if (yHit !== null) {
            this.velocity.y = 0;
            if (yHit === "foot") {
                this.isGrounded = true;
            }
        }

        // X/Z velocity is intentionally not zeroed on collision: input-driven
        // motion is set fresh each frame by PlayerController, so a stale value
        // never persists across frames.
        stepAxisX(this.body, this.chunkManager, deltaTime);
        stepAxisZ(this.body, this.chunkManager, deltaTime);
    }
}
