import Camera from "./core/Camera";
import Scene from "./core/Scene";
import InputManager from "./input/InputManager";
import Renderer from "./renderer/Renderer";

export default class Game {
    readonly scene: Scene;
    readonly camera: Camera;
    readonly renderer: Renderer;
    readonly input: InputManager;
    private rafId = 0;
    private observer: ResizeObserver;
    private pendingResize: { width: number; height: number } | null = null;

    constructor(container: HTMLElement) {
        this.scene = new Scene();
        this.camera = new Camera(75, container.clientWidth / container.clientHeight);
        this.renderer = new Renderer(container);
        this.input = InputManager.init(this.renderer.domElement);

        this.observer = new ResizeObserver(() => {
            this.pendingResize = {
                width: container.clientWidth,
                height: container.clientHeight,
            };
        });
        this.observer.observe(container);
    }

    start() {
        if (this.rafId !== 0) {
            return;
        }

        this.scene.start();

        const loop = () => {
            this.rafId = requestAnimationFrame(loop);
            if (this.pendingResize) {
                this.renderer.setSize(this.pendingResize.width, this.pendingResize.height);
                this.camera.setAspect(this.pendingResize.width / this.pendingResize.height);
                this.pendingResize = null;
            }
            this.scene.update();
            this.renderer.render(this.scene, this.camera);
            this.input.flush();
        };
        loop();
    }

    stop() {
        cancelAnimationFrame(this.rafId);
        this.observer.disconnect();
        this.input.dispose();
        this.renderer.dispose();
    }
}
