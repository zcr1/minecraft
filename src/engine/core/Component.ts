export default class Component {
	constructor() {}

	update() {}
}

export type ComponentConstructor<T extends Component> = new (...args: any[]) => T;
