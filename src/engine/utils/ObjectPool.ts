import GameObject from 'engine/core/GameObject';

export class ObjectPool {
	private pool: GameObject[] = [];
	// private objectFactory: new (...args: any[]);

	constructor(objectFactory: new (...args: any[]) => GameObject, initialSize: number = 100) {
		// this.objectFactory = objectFactory;
		// for (let i = 0; i < initialSize; i++) {
		// 	const newObject = new gameObject();
		// }
	}
}
