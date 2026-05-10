import * as THREE from "three";
import GameObject from "./GameObject";

const MAX_DELTA_TIME = 0.05;

export default class Scene {
    readonly threeScene: THREE.Scene;
    private readonly gameObjects = new Set<GameObject>();
    private lastTime = performance.now();
    fps = 0;

    constructor() {
        this.threeScene = new THREE.Scene();
        this.threeScene.background = new THREE.Color(0x1a1a2e);
    }

    start() {
        for (let gameObject of this.gameObjects) {
            gameObject.start();
        }
    }

    add(gameObject: GameObject): void {
        this.gameObjects.add(gameObject);
    }

    getGameObject(name: string): GameObject {
        for (const gameObject of this.gameObjects) {
            if (gameObject.name === name) {
                return gameObject;
            }
        }
        throw new Error(`Scene does not contain GameObject "${name}"`);
    }

    remove(gameObject: GameObject): void {
        this.gameObjects.delete(gameObject);
    }

    update() {
        const now = performance.now();
        const rawDeltaTime = (now - this.lastTime) / 1000;
        const deltaTime = Math.min(rawDeltaTime, MAX_DELTA_TIME);
        this.lastTime = now;
        this.fps = rawDeltaTime > 0 ? 1 / rawDeltaTime : 0;

        for (const gameObject of this.gameObjects) {
            gameObject.update(deltaTime);
        }
    }
}
