import * as THREE from "three";
import Component from "../core/Component";
import { BlockType } from "./ChunkComponent";
import type ChunkManager from "./ChunkManager";
import type Transform from "./Transform";

const GRAVITY = -20;
const TERMINAL_VEL = -30;
const MAX_DT = 0.05;
const HALF_W = 0.4;
const HALF_H = 0.9;

export default class PlayerPhysics extends Component {
    private readonly transform: Transform;
    private readonly chunkManager: ChunkManager;
    private velY = 0;
    private lastTime = performance.now();
    private readonly playerBox = new THREE.Box3();

    constructor(transform: Transform, chunkManager: ChunkManager) {
        super();
        this.transform = transform;
        this.chunkManager = chunkManager;
    }

    update() {
        const now = performance.now();
        const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
        this.lastTime = now;

        this.velY = Math.max(this.velY + GRAVITY * dt, TERMINAL_VEL);
        this.transform.y += this.velY * dt;

        this.resolveY();
    }

    private resolveY() {
        const { x, y, z } = this.transform;

        this.playerBox.set(
            new THREE.Vector3(x - HALF_W, y - HALF_H, z - HALF_W),
            new THREE.Vector3(x + HALF_W, y + HALF_H, z + HALF_W),
        );

        const minBlockX = Math.ceil(x - HALF_W - 0.5);
        const maxBlockX = Math.floor(x + HALF_W + 0.5);
        const minBlockZ = Math.ceil(z - HALF_W - 0.5);
        const maxBlockZ = Math.floor(z + HALF_W + 0.5);

        if (this.velY <= 0) {
            const footBlock = Math.round(y - HALF_H);
            for (let blockX = minBlockX; blockX <= maxBlockX; blockX++) {
                for (let blockZ = minBlockZ; blockZ <= maxBlockZ; blockZ++) {
                    if (this.chunkManager.getBlockAtWorld(blockX, footBlock, blockZ) !== BlockType.Air) {
                        this.transform.y = footBlock + 0.5 + HALF_H;
                        this.velY = 0;
                        return;
                    }
                }
            }
        } else {
            const headBlock = Math.round(y + HALF_H);
            for (let blockX = minBlockX; blockX <= maxBlockX; blockX++) {
                for (let blockZ = minBlockZ; blockZ <= maxBlockZ; blockZ++) {
                    if (this.chunkManager.getBlockAtWorld(blockX, headBlock, blockZ) !== BlockType.Air) {
                        this.transform.y = headBlock - 0.5 - HALF_H;
                        this.velY = 0;
                        return;
                    }
                }
            }
        }
    }
}
