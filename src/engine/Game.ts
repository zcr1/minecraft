import Camera from './core/Camera';
import InputManager from './input/InputManager';
import Renderer from './renderer/Renderer';
import Scene from './core/Scene';

export default class Game {
	readonly scene: Scene;
	readonly camera: Camera;
	readonly renderer: Renderer;
	readonly input: InputManager;
	private rafId = 0;
	private observer: ResizeObserver;

	constructor(mount: HTMLElement) {
		this.scene = new Scene();
		this.camera = new Camera(75, mount.clientWidth / mount.clientHeight);
		this.renderer = new Renderer(mount);
		this.input = InputManager.init(this.renderer.domElement);

		this.observer = new ResizeObserver(() => {
			this.renderer.setSize(mount.clientWidth, mount.clientHeight);
			this.camera.setAspect(mount.clientWidth / mount.clientHeight);
		});
		this.observer.observe(mount);
	}

	start() {
		if (this.rafId !== 0) {
			return;
		}

		const loop = () => {
			this.rafId = requestAnimationFrame(loop);
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
