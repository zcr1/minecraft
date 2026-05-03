import * as THREE from 'three';

import GameObject from './GameObject';

export default class Scene {
	readonly threeScene: THREE.Scene;
	gameObjects: GameObject[];

	constructor() {
		this.threeScene = new THREE.Scene();
		this.threeScene.background = new THREE.Color(0x1a1a2e);
		this.gameObjects = [];
	}

	update() {
		for (let i = 0; i < this.gameObjects.length; i++) {
			this.gameObjects[i].update();
		}
	}
}
