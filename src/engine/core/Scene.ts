import GameObject from './GameObject';

export default class Scene {
	gameObjects: GameObject[];

	constructor() {
		this.gameObjects = [];
	}

	update() {
		this.gameObjects.forEach(go => go.update());
	}
}
