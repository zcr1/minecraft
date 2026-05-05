import * as THREE from "three";

import GameObject from "./GameObject";

export default class Scene {
    readonly threeScene: THREE.Scene;
    private readonly gameObjects = new Set<GameObject>();

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
        for (const go of this.gameObjects) {
            go.update();
        }
    }
}
