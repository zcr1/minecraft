import GameObject from './GameObject';

export default class Scene {
	gameObjects: GameObject[];

	constructor() {
		this.gameObjects = [];
	}
}
