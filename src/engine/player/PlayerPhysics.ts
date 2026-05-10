import * as THREE from "three";
import { BlockType } from "engine/chunk/ChunkComponent";
import type ChunkManager from "engine/chunk/ChunkManager";
import Transform from "engine/components/Transform";
import Component from "../core/Component";

const GRAVITY = -20;
const TERMINAL_VEL = -30;
const HALF_WIDTH = 0.4;
const HALF_HEIGHT = 0.9;
const SKIN_WIDTH = 1e-4;

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
        this.resolveX();
        this.resolveZ();
    }

    private resolveX() {
        const { x, y, z } = this.transform;

        const minBlockY = Math.ceil(y - HALF_HEIGHT - 0.5);
        const maxBlockY = Math.floor(y + HALF_HEIGHT + 0.5);
        const minBlockZ = Math.ceil(z - HALF_WIDTH - 0.5);
        const maxBlockZ = Math.floor(z + HALF_WIDTH + 0.5);

        const rightBlock = Math.round(x + HALF_WIDTH);
        for (let blockY = minBlockY; blockY <= maxBlockY; blockY++) {
            for (let blockZ = minBlockZ; blockZ <= maxBlockZ; blockZ++) {
                if (this.chunkManager.getBlockAtWorld(rightBlock, blockY, blockZ) !== BlockType.Air) {
                    this.transform.x = rightBlock - 0.5 - HALF_WIDTH - SKIN_WIDTH;
                    return;
                }
            }
        }

        const leftBlock = Math.round(x - HALF_WIDTH);
        for (let blockY = minBlockY; blockY <= maxBlockY; blockY++) {
            for (let blockZ = minBlockZ; blockZ <= maxBlockZ; blockZ++) {
                if (this.chunkManager.getBlockAtWorld(leftBlock, blockY, blockZ) !== BlockType.Air) {
                    this.transform.x = leftBlock + 0.5 + HALF_WIDTH + SKIN_WIDTH;
                    return;
                }
            }
        }
    }

    private resolveZ() {
        const { x, y, z } = this.transform;

        const minBlockY = Math.ceil(y - HALF_HEIGHT - 0.5);
        const maxBlockY = Math.floor(y + HALF_HEIGHT + 0.5);
        const minBlockX = Math.ceil(x - HALF_WIDTH - 0.5);
        const maxBlockX = Math.floor(x + HALF_WIDTH + 0.5);

        const frontBlock = Math.round(z + HALF_WIDTH);
        for (let blockY = minBlockY; blockY <= maxBlockY; blockY++) {
            for (let blockX = minBlockX; blockX <= maxBlockX; blockX++) {
                if (this.chunkManager.getBlockAtWorld(blockX, blockY, frontBlock) !== BlockType.Air) {
                    this.transform.z = frontBlock - 0.5 - HALF_WIDTH - SKIN_WIDTH;
                    return;
                }
            }
        }

        const backBlock = Math.round(z - HALF_WIDTH);
        for (let blockY = minBlockY; blockY <= maxBlockY; blockY++) {
            for (let blockX = minBlockX; blockX <= maxBlockX; blockX++) {
                if (this.chunkManager.getBlockAtWorld(blockX, blockY, backBlock) !== BlockType.Air) {
                    this.transform.z = backBlock + 0.5 + HALF_WIDTH + SKIN_WIDTH;
                    return;
                }
            }
        }
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
                        this.transform.y = footBlock + 0.5 + HALF_HEIGHT + SKIN_WIDTH;
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
                        this.transform.y = headBlock - 0.5 - HALF_HEIGHT - SKIN_WIDTH;
                        this.velY = 0;
                        return;
                    }
                }
            }
        }
    }
}
