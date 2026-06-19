import * as THREE from "three";
import game from "engine/Game";
import { BlockType } from "engine/block/BlockType";
import ChunkManager from "engine/chunk/ChunkManager";
import Transform from "engine/components/Transform";
import { PhysicsBody, applyGravity, stepAxisX, stepAxisY, stepAxisZ } from "engine/physics/voxelPhysics";
import GameObjectName from "engine/utils/gameObjectNames";
import Component from "../core/Component";

const GRAVITY = -20;
const TERMINAL_VELOCITY = -30;
const PLAYER_HALF_WIDTH = 0.3;
const PLAYER_HALF_HEIGHT = 0.9;
const WATER_GRAVITY = -10;
const WATER_TERMINAL_VELOCITY = -10;
const WATER_Y_DRAG = 8;
const PLAYER_EYE_OFFSET = 0.5;

// Returns true if the player's AABB intersects the 1×1×1 block centered at the given world coords.
export function playerOverlapsBlock(
    playerTransform: Transform,
    worldX: number,
    worldY: number,
    worldZ: number,
): boolean {
    return (
        playerTransform.x + PLAYER_HALF_WIDTH > worldX - 0.5 &&
        playerTransform.x - PLAYER_HALF_WIDTH < worldX + 0.5 &&
        playerTransform.y + PLAYER_HALF_HEIGHT > worldY - 0.5 &&
        playerTransform.y - PLAYER_HALF_HEIGHT < worldY + 0.5 &&
        playerTransform.z + PLAYER_HALF_WIDTH > worldZ - 0.5 &&
        playerTransform.z - PLAYER_HALF_WIDTH < worldZ + 0.5
    );
}

export default class PlayerPhysics extends Component {
    private transform!: Transform;
    private chunkManager!: ChunkManager;
    private body!: PhysicsBody;
    noClipEnabled = false;
    isGrounded = false;
    isInWater = false;
    isHeadInWater = false;
    velocity = new THREE.Vector3();

    start() {
        this.transform = this.gameObject.getComponent(Transform);
        this.chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);
        this.body = {
            position: this.transform,
            velocity: this.velocity,
            halfWidth: PLAYER_HALF_WIDTH,
            halfHeight: PLAYER_HALF_HEIGHT,
        };
    }

    update(deltaTime: number) {
        if (this.noClipEnabled) {
            this.isInWater = false;
            this.isHeadInWater = false;
            this.body.position.x += this.velocity.x * deltaTime;
            this.body.position.y += this.velocity.y * deltaTime;
            this.body.position.z += this.velocity.z * deltaTime;
            return;
        }

        this.updateWaterState();

        // Each axis is stepped and resolved independently so that a wall in one
        // axis can't be mistaken for a collision in another (e.g. a corner block
        // seen via perpendicular AABB straddle triggering an incorrect X snap).
        // Y is resolved first so the player is on solid ground before horizontal
        // collision runs.
        this.isGrounded = false;

        if (this.isInWater) {
            // Exponential drag dampens any large entry velocity (e.g. falling into water).
            this.velocity.y *= Math.exp(-WATER_Y_DRAG * deltaTime);
            applyGravity(this.body, deltaTime, WATER_GRAVITY, WATER_TERMINAL_VELOCITY);
        } else {
            applyGravity(this.body, deltaTime, GRAVITY, TERMINAL_VELOCITY);
        }

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

    private updateWaterState() {
        const blockX = Math.round(this.transform.x);
        const blockZ = Math.round(this.transform.z);
        const feetBlockY = Math.round(this.transform.y - PLAYER_HALF_HEIGHT);
        const midBlockY = Math.round(this.transform.y);
        const eyeBlockY = Math.round(this.transform.y + PLAYER_EYE_OFFSET);

        const feetBlock = this.chunkManager.getBlockAtWorld(blockX, feetBlockY, blockZ);
        const midBlock = this.chunkManager.getBlockAtWorld(blockX, midBlockY, blockZ);
        const eyeBlock = this.chunkManager.getBlockAtWorld(blockX, eyeBlockY, blockZ);

        this.isInWater = feetBlock === BlockType.Water || midBlock === BlockType.Water;
        this.isHeadInWater = eyeBlock === BlockType.Water;
    }
}
