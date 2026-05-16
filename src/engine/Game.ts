import * as THREE from "three";
import Camera from "./core/Camera";
import GameObject from "./core/GameObject";
import input from "./input/Input";
import Renderer from "./renderer/Renderer";

const MAX_DELTA_TIME = 0.05;

class Game {
    threeScene!: THREE.Scene;
    camera!: Camera;
    renderer!: Renderer;
    fps = 0;

    private readonly gameObjects = new Set<GameObject>();
    private lastTime = performance.now();
    private rafId = 0;
    private observer!: ResizeObserver;
    private pendingResize: { width: number; height: number } | null = null;

    init(container: HTMLElement) {
        this.threeScene = new THREE.Scene();
        this.threeScene.background = new THREE.Color(0x1a1a2e);
        this.camera = new Camera(75, container.clientWidth / container.clientHeight);
        this.renderer = new Renderer(container);
        input.init(this.renderer.domElement);

        this.observer = new ResizeObserver(() => {
            this.pendingResize = {
                width: container.clientWidth,
                height: container.clientHeight,
            };
        });
        this.observer.observe(container);
    }

    add(gameObject: GameObject): void {
        this.gameObjects.add(gameObject);
    }

    remove(gameObject: GameObject): void {
        this.gameObjects.delete(gameObject);
    }

    getGameObject(name: string): GameObject {
        for (const gameObject of this.gameObjects) {
            if (gameObject.name === name) {
                return gameObject;
            }
        }
        throw new Error(`Game does not contain GameObject "${name}"`);
    }

    start() {
        if (this.rafId !== 0) {
            return;
        }

        for (const gameObject of this.gameObjects) {
            gameObject.start();
        }

        this.lastTime = performance.now();

        const loop = () => {
            this.rafId = requestAnimationFrame(loop);
            if (this.pendingResize) {
                this.renderer.setSize(this.pendingResize.width, this.pendingResize.height);
                this.camera.setAspect(this.pendingResize.width / this.pendingResize.height);
                this.pendingResize = null;
            }

            const now = performance.now();
            const rawDeltaTime = (now - this.lastTime) / 1000;
            const deltaTime = Math.min(rawDeltaTime, MAX_DELTA_TIME);
            this.lastTime = now;
            this.fps = rawDeltaTime > 0 ? 1 / rawDeltaTime : 0;

            for (const gameObject of this.gameObjects) {
                gameObject.update(deltaTime);
            }

            this.renderer.render(this.threeScene, this.camera);
            input.flush();
        };
        loop();
    }

    stop() {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
        this.gameObjects.clear();
        this.observer.disconnect();
        input.dispose();
        this.renderer.dispose();
    }
}

export default new Game();
