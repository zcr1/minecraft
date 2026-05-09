import * as THREE from "three";

import GameObject from "./GameObject";

const MAX_DELTA_TIME = 0.05;

export default class Scene {
    readonly threeScene: THREE.Scene;
    private readonly gameObjects = new Set<GameObject>();
    private lastTime = performance.now();

    constructor() {
        this.threeScene = new THREE.Scene();
        this.threeScene.background = new THREE.Color(0x1a1a2e);
    }

    add(gameObject: GameObject): void {
        this.gameObjects.add(gameObject);
    }

    remove(gameObject: GameObject): void {
        this.gameObjects.delete(gameObject);
    }

    update() {
        const now = performance.now();
        const deltaTime = Math.min((now - this.lastTime) / 1000, MAX_DELTA_TIME);
        this.lastTime = now;

        for (const gameObject of this.gameObjects) {
            gameObject.update(deltaTime);
        }
    }
}
