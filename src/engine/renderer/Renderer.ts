import * as THREE from "three";
import type Camera from "../core/Camera";
import type Scene from "../core/Scene";

export default class Renderer {
    private renderer: THREE.WebGLRenderer;

    constructor(mount: HTMLElement) {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(mount.clientWidth, mount.clientHeight);
        mount.appendChild(this.renderer.domElement);
    }

    render(scene: Scene, camera: Camera) {
        this.renderer.render(scene.threeScene, camera.threeCamera);
    }

    setSize(width: number, height: number) {
        this.renderer.setSize(width, height);
    }

    get domElement() {
        return this.renderer.domElement;
    }

    dispose() {
        this.renderer.domElement.remove();
        this.renderer.dispose();
    }
}
