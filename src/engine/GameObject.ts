import Component, { type ComponentConstructor } from './Component';

export default class GameObject {
	private name: string;
	private components: Map<ComponentConstructor<any>, Component>;
	enabled: boolean;

	constructor(name: string) {
		this.name = name;
		this.components = new Map();
		this.enabled = true;
	}

	update() {
		if (!this.enabled) {
			return;
		}

		this.components.forEach(component => {
			component.update();
		});
	}

	addComponent<T extends Component>(component: T) {
		const type = component.constructor as new () => T;

		if (this.components.has(type)) {
			throw new Error(`${this.name} already has component ${type}`);
		}

		this.components.set(type, component);
	}

	getComponent<T extends Component>(type: ComponentConstructor<T>) {
		const component = this.components.get(type);

		if (!component) {
			throw new Error(`${this.name} does not have component ${type}`);
		}

		return component;
	}

	removeComponent<T extends Component>(type: ComponentConstructor<T>) {
		this.components.delete(type);
	}
}
