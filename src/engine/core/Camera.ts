import * as THREE from 'three';

export default class Camera {
	readonly threeCamera: THREE.PerspectiveCamera;

	constructor(fov = 75, aspect = 1, near = 0.1, far = 1000) {
		this.threeCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
		this.threeCamera.position.z = 5;
	}

	setAspect(aspect: number) {
		this.threeCamera.aspect = aspect;
		this.threeCamera.updateProjectionMatrix();
	}
}
