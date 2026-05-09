import * as THREE from "three";
import Component from "../core/Component";
import { BlockType } from "./ChunkComponent";
import type ChunkManager from "./ChunkManager";
import Transform from "./Transform";

const GRAVITY = -20;
const TERMINAL_VEL = -30;
const HALF_WIDTH = 0.4;
const HALF_HEIGHT = 0.9;

export default class PlayerPhysics extends Component {
    private transform!: Transform;
    private readonly chunkManager: ChunkManager;
    private velY = 0;
    private readonly playerBox = new THREE.Box3();

    constructor(chunkManager: ChunkManager) {
        super();
        this.chunkManager = chunkManager;
    }

    start() {
        this.transform = this.gameObject.getComponent(Transform);
    }

    update(deltaTime: number) {
        this.velY = Math.max(this.velY + GRAVITY * deltaTime, TERMINAL_VEL);
        this.transform.y += this.velY * deltaTime;
        this.resolveY();
    }

    private resolveY() {
        const { x, y, z } = this.transform;

        this.playerBox.set(
            new THREE.Vector3(x - HALF_WIDTH, y - HALF_HEIGHT, z - HALF_WIDTH),
            new THREE.Vector3(x + HALF_WIDTH, y + HALF_HEIGHT, z + HALF_WIDTH),
        );

        const minBlockX = Math.ceil(x - HALF_WIDTH - 0.5);
        const maxBlockX = Math.floor(x + HALF_WIDTH + 0.5);
        const minBlockZ = Math.ceil(z - HALF_WIDTH - 0.5);
        const maxBlockZ = Math.floor(z + HALF_WIDTH + 0.5);

        if (this.velY <= 0) {
            const footBlock = Math.round(y - HALF_HEIGHT);
            for (let blockX = minBlockX; blockX <= maxBlockX; blockX++) {
                for (let blockZ = minBlockZ; blockZ <= maxBlockZ; blockZ++) {
                    if (this.chunkManager.getBlockAtWorld(blockX, footBlock, blockZ) !== BlockType.Air) {
                        this.transform.y = footBlock + 0.5 + HALF_HEIGHT;
                        this.velY = 0;
                        return;
                    }
                }
            }
        } else {
            const headBlock = Math.round(y + HALF_HEIGHT);
            for (let blockX = minBlockX; blockX <= maxBlockX; blockX++) {
                for (let blockZ = minBlockZ; blockZ <= maxBlockZ; blockZ++) {
                    if (this.chunkManager.getBlockAtWorld(blockX, headBlock, blockZ) !== BlockType.Air) {
                        this.transform.y = headBlock - 0.5 - HALF_HEIGHT;
                        this.velY = 0;
                        return;
                    }
                }
            }
        }
    }
}
